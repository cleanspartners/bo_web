
import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readItems, updateItems, createItem } from '@directus/sdk';
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
    ChevronsDown
} from 'lucide-react';
import ChannelDetailModal from '../components/ChannelDetailModal';

export default function ChannelListPage() {
    // Data State
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    // Filter State
    const [filters, setFilters] = useState({
        channel_name: '',
        status: 'all'
    });
    const [isSearchExpanded, setIsSearchExpanded] = useState(true);

    // Pagination State
    const [pagination, setPagination] = useState({
        pageIndex: 1,
        pageSize: 10,
    });

    // Selection State
    const [selectedRows, setSelectedRows] = useState([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);

    // Fetch Data
    const fetchChannels = async () => {
        setLoading(true);
        try {
            const filter = {
                _and: [
                    { del_yn: { _neq: 'Y' } }
                ]
            };

            if (filters.channel_name) {
                filter._and.push({ channel_name: { _contains: filters.channel_name } });
            }
            if (filters.status && filters.status !== 'all') {
                filter._and.push({ status: { _eq: filters.status } });
            }

            const [data, countData] = await Promise.all([
                client.request(readItems('chnnl_mstr', {
                    fields: ['*', 'user_created.*'],
                    filter: filter,
                    sort: ['-date_created'],
                    page: pagination.pageIndex,
                    limit: pagination.pageSize,
                })),
                client.request(readItems('chnnl_mstr', {
                    filter: filter,
                    limit: 1,
                    meta: 'filter_count'
                }))
            ]);

            setChannels(data);

            if (countData && countData.meta) {
                setTotalCount(countData.meta.filter_count);
            } else {
                setTotalCount(data.length);
            }

        } catch (error) {
            console.error('Error fetching channels:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChannels();
    }, [pagination.pageIndex, pagination.pageSize]);

    const handleSearch = () => {
        setPagination(prev => ({ ...prev, pageIndex: 1 }));
        fetchChannels();
    };

    const handleReset = () => {
        setFilters({ channel_name: '', status: 'all' });
        setPagination(prev => ({ ...prev, pageIndex: 1 }));
        // fetchChannels() will trigger via useEffect if we add dependency or just call it here?
        // Better to rely on state change or explicit call.
        setTimeout(fetchChannels, 0);
    };

    // ... Handlers for Delete, Edit, Create ... (Skipping full implementation for brevity in thought, but will write full code)

    // Delete
    const handleDeleteSelected = async () => {
        if (!confirm('선택한 항목을 삭제하시겠습니까?')) return;
        try {
            await client.request(updateItems('chnnl_mstr', selectedRows, { del_yn: 'Y' }));
            fetchChannels();
            setSelectedRows([]);
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    return (
        <div className="space-y-4 p-4 bg-gray-50 h-full flex flex-col">
            {/* Filter Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-lg font-bold text-gray-800">조회 조건</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                    >
                        {isSearchExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                    </Button>
                </div>

                {isSearchExpanded && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">채널명</label>
                                <Input
                                    value={filters.channel_name}
                                    onChange={(e) => setFilters({ ...filters, channel_name: e.target.value })}
                                    placeholder="채널명 입력"
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">상태</label>
                                <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="전체" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체</SelectItem>
                                        <SelectItem value="활성화">활성화</SelectItem>
                                        <SelectItem value="비활성화">비활성화</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-center gap-2 mt-4 border-t pt-4">
                            <Button variant="outline" onClick={handleReset} className="w-24 h-8 text-xs">
                                <RefreshCw className="w-3 h-3 mr-1" /> 초기화
                            </Button>
                            <Button onClick={handleSearch} className="w-24 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                <Search className="w-3 h-3 mr-1" /> 검색
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b flex flex-col sm:flex-row justify-between items-center gap-2 bg-gray-50/50">
                    <div className="text-sm font-medium text-gray-600 w-full sm:w-auto text-center sm:text-left">
                        총 <span className="text-blue-600 font-bold">{totalCount}</span> 건
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedRows.length === 0} className="w-full sm:w-auto h-8 text-xs">
                            선택 삭제
                        </Button>
                        <Button size="sm" onClick={() => { setSelectedChannel(null); setIsModalOpen(true); }} className="w-full sm:w-auto h-8 text-xs bg-blue-600">
                            + 신규 등록
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-100 z-10">
                            <TableRow>
                                <TableHead className="w-[40px] text-center">
                                    <Checkbox
                                        checked={channels.length > 0 && selectedRows.length === channels.length}
                                        onCheckedChange={(checked) => setSelectedRows(checked ? channels.map(c => c.id) : [])}
                                    />
                                </TableHead>
                                <TableHead className="w-[60px] text-center">No.</TableHead>
                                <TableHead className="text-center">채널명</TableHead>
                                <TableHead className="text-center">상태</TableHead>
                                <TableHead className="text-center">등록자</TableHead>
                                <TableHead className="text-center">등록일시</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center">로딩 중...</TableCell></TableRow>
                            ) : channels.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center">데이터가 없습니다.</TableCell></TableRow>
                            ) : (
                                channels.map((channel, idx) => (
                                    <TableRow key={channel.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedChannel(channel); setIsModalOpen(true); }}>
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedRows.includes(channel.id)}
                                                onCheckedChange={(checked) => setSelectedRows(prev => checked ? [...prev, channel.id] : prev.filter(id => id !== channel.id))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">{(pagination.pageIndex - 1) * pagination.pageSize + idx + 1}</TableCell>
                                        <TableCell className="text-center font-medium">{channel.channel_name}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={channel.status === '활성화' ? 'default' : 'secondary'}>{channel.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">{channel.user_created?.first_name || '-'} {channel.user_created?.last_name || ''}</TableCell>
                                        <TableCell className="text-center">{new Date(channel.date_created).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination (Simplified for now) */}
                <div className="p-3 border-t flex justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.pageIndex === 1} onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center text-sm">Page {pagination.pageIndex}</span>
                    <Button variant="outline" size="sm" disabled={channels.length < pagination.pageSize} onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Modal */}
            <ChannelDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                channel={selectedChannel}
                onRefresh={fetchChannels}
            />
        </div>
    );
}
