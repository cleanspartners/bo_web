import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readUsers, readRoles, readItems, updateUser, updateItems } from '@directus/sdk';
import UserDetailModal from '../components/UserDetailModal';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RefreshCw,
    ChevronsUp,
    ChevronsDown,
    Download
} from 'lucide-react';

export default function UserListPage() {
    // Data State
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [userDetailModalOpen, setUserDetailModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUserDetail, setSelectedUserDetail] = useState(null);

    // Detail Data Map
    const [userDetailsMap, setUserDetailsMap] = useState({});

    // Filter State
    const [filters, setFilters] = useState({
        role: '',
        first_name: '', // 회사명
        last_name: '',  // 팀장명
        email: ''
    });

    const [isSearchExpanded, setIsSearchExpanded] = useState(true);

    // Pagination State
    const [pagination, setPagination] = useState({
        pageIndex: 1,
        pageSize: 10
    });

    // Selection State
    const [selectedRows, setSelectedRows] = useState([]);

    useEffect(() => {
        fetchRoles();
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [pagination.pageIndex, pagination.pageSize]);

    const fetchRoles = async () => {
        try {
            const response = await client.request(readRoles({
                fields: ['id', 'name'],
                sort: ['name']
            }));
            const roleMap = {};
            response.forEach(role => {
                roleMap[role.id] = role.name;
            });
            setRoles(response);
        } catch (error) {
            console.error("Failed to fetch roles:", error);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const filterQuery = {
                _and: [
                    { del_yn: { _neq: 'Y' } } // Only active users
                ]
            };

            // Apply Filters
            if (filters.first_name) {
                filterQuery._and.push({ first_name: { _icontains: filters.first_name } });
            }
            if (filters.last_name) {
                filterQuery._and.push({ last_name: { _icontains: filters.last_name } });
            }
            if (filters.email) {
                filterQuery._and.push({ email: { _icontains: filters.email } });
            }

            // Role filter
            if (filters.role && filters.role !== 'all') {
                filterQuery._and.push({ role: { _eq: filters.role } });
            }

            const response = await client.request(readUsers({
                limit: pagination.pageSize,
                page: pagination.pageIndex,
                filter: filterQuery,
                fields: ['*', 'role.name', 'role.id'],
                sort: ['-last_access'], // Keep last_access to avoid permission issues
                meta: 'filter_count'
            }));

            setUsers(response);

            // Fetch usr_dtl for these users
            if (response.length > 0) {
                const userIds = response.map(u => u.id);
                try {
                    const detailResponse = await client.request(readItems('usr_dtl', {
                        filter: {
                            user_id: { _in: userIds }
                        },
                        fields: ['*', 'biz_licns_file.*']
                    }));
                    const dtMap = {};
                    detailResponse.forEach(dt => {
                        dtMap[dt.user_id] = dt;
                    });
                    setUserDetailsMap(dtMap);
                } catch (dtError) {
                    console.error("Failed to fetch user details:", dtError);
                }
            } else {
                setUserDetailsMap({});
            }

        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPagination(prev => ({ ...prev, pageIndex: 1 }));
        fetchUsers();
    };

    const handleReset = () => {
        setFilters({
            role: '',
            first_name: '',
            last_name: '',
            email: ''
        });
        setPagination(prev => ({ ...prev, pageIndex: 1 }));
        setTimeout(fetchUsers, 0);
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedRows(users.map(u => u.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id, checked) => {
        if (checked) {
            setSelectedRows(prev => [...prev, id]);
        } else {
            setSelectedRows(prev => prev.filter(rowId => rowId !== id));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedRows.length === 0) {
            alert("삭제할 사용자를 선택해주세요.");
            return;
        }

        if (!confirm(`선택한 ${selectedRows.length}명의 사용자를 삭제하시겠습니까?`)) return;

        try {
            setLoading(true);

            // 1. Update directus_users (del_yn = 'Y')
            // Using Promise.all for multiple user updates
            const userUpdatePromises = selectedRows.map(id =>
                client.request(updateUser(id, { del_yn: 'Y' }))
            );
            await Promise.all(userUpdatePromises);

            // 2. Update usr_dtl (del_yn = 'Y')
            // First find detail IDs for selected users
            const detailsToUpdate = [];
            for (const userId of selectedRows) {
                const detail = userDetailsMap[userId];
                if (detail && detail.id) {
                    detailsToUpdate.push(detail.id);
                }
            }

            if (detailsToUpdate.length > 0) {
                await client.request(updateItems('usr_dtl', detailsToUpdate, {
                    del_yn: 'Y'
                }));
            }

            alert("삭제되었습니다.");
            setSelectedRows([]);
            fetchUsers();

        } catch (error) {
            console.error("삭제 실패:", error);
            alert("삭제 중 오류가 발생했습니다. (권한을 확인해주세요)");
        } finally {
            setLoading(false);
        }
    };

    // Format Helpers
    const formatStatus = (status) => {
        const map = {
            'active': '등록완료',
            'draft': '임시저장',
            'suspended': '정지',
            'invited': '초대됨'
        };
        return map[status] || status || '-';
    };

    const handleRowClick = (user) => {
        setSelectedUser(user);
        setSelectedUserDetail(userDetailsMap[user.id] || null);
        setUserDetailModalOpen(true);
    };

    const handleCreateClick = () => {
        setSelectedUser(null);
        setSelectedUserDetail(null);
        setUserDetailModalOpen(true);
    };

    return (
        <div className="space-y-4 p-4 bg-gray-50 h-full flex flex-col">
            {/* Search Filter Section - Matched to OrderListPage */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-lg font-bold text-gray-800">조회 조건</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                    >
                        {isSearchExpanded ? (
                            <ChevronsUp className="h-4 w-4 text-gray-500" />
                        ) : (
                            <ChevronsDown className="h-4 w-4 text-gray-500" />
                        )}
                    </Button>
                </div>

                {isSearchExpanded && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Role Filter */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">권한 그룹 명</label>
                                <Select
                                    value={filters.role}
                                    onValueChange={(value) => setFilters(prev => ({ ...prev, role: value }))}
                                >
                                    <SelectTrigger className="w-full h-9 text-sm border-gray-300">
                                        <SelectValue placeholder="전체" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체</SelectItem>
                                        {roles.map(role => (
                                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Company Name Filter */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">회사명</label>
                                <Input
                                    placeholder="입력하세요"
                                    className="w-full h-9 text-sm border-gray-300"
                                    value={filters.first_name}
                                    onChange={(e) => setFilters(prev => ({ ...prev, first_name: e.target.value }))}
                                />
                            </div>

                            {/* Team Leader Name Filter */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">팀장명</label>
                                <Input
                                    placeholder="입력하세요"
                                    className="w-full h-9 text-sm border-gray-300"
                                    value={filters.last_name}
                                    onChange={(e) => setFilters(prev => ({ ...prev, last_name: e.target.value }))}
                                />
                            </div>

                            {/* Email Filter */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">이메일</label>
                                <Input
                                    placeholder="입력하세요"
                                    className="w-full h-9 text-sm border-gray-300"
                                    value={filters.email}
                                    onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="col-span-full flex justify-center gap-2 mt-4 border-t pt-4">
                            <Button type="button" variant="outline" onClick={handleReset} className="w-24 h-8 text-xs">
                                <RefreshCw className="w-3 h-3 mr-1" />
                                초기화
                            </Button>
                            <Button onClick={handleSearch} className="w-24 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                <Search className="w-3 h-3 mr-1" />
                                검색
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {/* Data Table Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b flex flex-col sm:flex-row justify-between items-center gap-2 bg-gray-50/50">
                    <div className="text-sm font-medium text-gray-600">
                        관리자 정보 <span className="mx-2 text-gray-300">|</span> 총 <span className="text-blue-600 font-bold">{users.length}</span> 건
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-transparent"
                            onClick={handleDeleteSelected}
                            disabled={selectedRows.length === 0}
                        >
                            선택 삭제
                        </Button>
                        <Button
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                            onClick={handleCreateClick}
                        >
                            + 사용자 등록
                        </Button>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent">
                            <Download className="w-3 h-3 mr-1" /> EXCEL
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-100 z-10 shadow-sm">
                            <TableRow className="bg-gray-100 hover:bg-gray-100 text-xs text-gray-600 font-semibold whitespace-nowrap">
                                <TableHead className="w-[40px] text-center">
                                    <Checkbox
                                        checked={users.length > 0 && selectedRows.length === users.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[60px] text-center">No.</TableHead>
                                <TableHead className="text-center">권한그룹명</TableHead>
                                <TableHead className="text-center">회사명</TableHead>
                                <TableHead className="text-center">팀장명</TableHead>
                                <TableHead className="text-center">이메일</TableHead>
                                <TableHead className="text-center">부서정보</TableHead>
                                <TableHead className="text-center">등록상태</TableHead>
                                <TableHead className="text-center">마지막 접속일시</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-gray-500">
                                        데이터를 불러오는 중입니다...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-gray-500">
                                        검색 결과가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user, index) => (
                                    <TableRow
                                        key={user.id}
                                        className="hover:bg-blue-50/50 cursor-pointer transition-colors text-xs"
                                        onClick={(e) => {
                                            if (e.target.closest('[role="checkbox"]') || e.target.closest('button')) return;
                                            handleRowClick(user);
                                        }}
                                    >
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedRows.includes(user.id)}
                                                onCheckedChange={(checked) => handleSelectRow(user.id, checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500">{index + 1}</TableCell>
                                        <TableCell className="text-center">{user.role?.name || '-'}</TableCell>
                                        <TableCell className="text-center font-medium text-blue-600">{user.first_name || '-'}</TableCell>
                                        <TableCell className="text-center">{user.last_name || '-'}</TableCell>
                                        <TableCell className="text-center">{user.email}</TableCell>
                                        <TableCell className="text-center">{user.title || '-'}</TableCell>
                                        <TableCell className="text-center">
                                            {userDetailsMap[user.id] ? (
                                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Y</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-400 border-gray-200">N</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500">
                                            {user.last_access ? new Date(user.last_access).toLocaleString() : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <UserDetailModal
                isOpen={userDetailModalOpen}
                onClose={() => setUserDetailModalOpen(false)}
                user={selectedUser}
                userDetail={selectedUserDetail}
                onUpdate={fetchUsers}
                roles={roles}
            />
        </div>
    );
}
