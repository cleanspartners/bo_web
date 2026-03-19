import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readItems, updateItems } from '@directus/sdk';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    ChevronsUp,
    ChevronsDown
} from 'lucide-react';
import ChannelDetailModal from '../components/ChannelDetailModal';
import ChannelCombobox from '../components/ChannelCombobox';

export default function ChannelListPage() {
    // --- [데이터 상태] ---
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    // --- [필터 및 UI 상태] ---
    const [filters, setFilters] = useState({
        channelId: '',
        status: 'all'
    });
    const [isSearchExpanded, setIsSearchExpanded] = useState(true);

    // --- [페이지네이션 상태] ---
    const [pagination, setPagination] = useState({
        pageIndex: 1,
        pageSize: 10,
    });

    // --- [선택 및 모달 상태] ---
    const [selectedRows, setSelectedRows] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);

    // --- [데이터 패칭] ---
    const fetchChannels = async () => {
        setLoading(true);
        try {
            const filter = {
                _and: [{ del_yn: { _neq: 'Y' } }]
            };

            if (filters.channelId) {
                filter._and.push({ id: { _eq: filters.channelId } });
            }
            if (filters.status && filters.status !== 'all') {
                filter._and.push({ status: { _eq: filters.status } });
            }

            const [data, countData] = await Promise.all([
                client.request(readItems('chnnl_mstr', {
                    fields: ['*', 'user_created.*'], // channel_fee_rate 포함
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
            if (countData?.meta) {
                setTotalCount(countData.meta.filter_count);
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

    // --- [핸들러 로직] ---
    const handleSearch = () => {
        setPagination(prev => ({ ...prev, pageIndex: 1 }));
        fetchChannels();
    };

    const handleReset = () => {
        setFilters({ channelId: '', status: 'all' });
        setPagination(prev => ({ ...prev, pageIndex: 1 }));
        setTimeout(fetchChannels, 0);
    };

    const handleDeleteSelected = async () => {
        if (!confirm('선택한 항목을 삭제하시겠습니까?')) return;
        try {
            await client.request(updateItems('chnnl_mstr', selectedRows, { del_yn: 'Y' }));
            fetchChannels();
            setSelectedRows([]);
        } catch (e) {
            alert('삭제 실패');
        }
    };

    return (
        <div className="space-y-4 p-4 bg-gray-50 flex flex-col h-auto md:h-full">
            {/* 조회 조건 섹션 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2 text-gray-800 font-bold">
                    <h2>조회 조건</h2>
                </div>

                {isSearchExpanded && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">채널명</label>
                                <ChannelCombobox
                                    value={filters.channelId}
                                    onChange={(val) => setFilters(prev => ({ ...prev, channelId: val }))}
                                    placeholder="채널 선택"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">상태</label>
                                <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                                    <SelectTrigger className="h-9 text-sm text-gray-900 bg-white"><SelectValue placeholder="전체" /></SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="all">전체</SelectItem>
                                        <SelectItem value="활성화">활성화</SelectItem>
                                        <SelectItem value="비활성화">비활성화</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-center gap-2 mt-4 border-t pt-4">
                            <Button variant="outline" onClick={handleReset} className="w-24 h-8 text-xs bg-white">
                                <RefreshCw className="w-3 h-3 mr-1" /> 초기화
                            </Button>
                            <Button onClick={handleSearch} className="w-24 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                <Search className="w-3 h-3 mr-1" /> 검색
                            </Button>
                        </div>
                    </>
                )}
                <div
                    className="flex justify-center items-center mt-2 pt-2 border-t border-gray-100 cursor-pointer"
                    onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                >
                    {isSearchExpanded ? <ChevronsUp className="h-5 w-5 text-gray-400" /> : <ChevronsDown className="h-5 w-5 text-gray-400" />}
                </div>
            </div>

            {/* 테이블 섹션 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-[500px] md:min-h-0">
                <div className="p-3 border-b flex flex-col sm:flex-row justify-between items-center gap-2 bg-gray-50/50">
                    <div className="text-sm font-medium text-gray-600">
                        총 <span className="text-blue-600 font-bold">{totalCount}</span> 건
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelected}
                            disabled={selectedRows.length === 0}
                            className="h-8 text-xs bg-red-600 text-white hover:bg-red-700"
                        >
                            선택 삭제
                        </Button>
                        <Button size="sm" onClick={() => { setSelectedChannel(null); setIsModalOpen(true); }} className="h-8 text-xs bg-blue-600 text-white hover:bg-blue-700">
                            + 신규 등록
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-100 z-10 text-gray-900">
                            <TableRow>
                                <TableHead className="w-[40px] text-center">
                                    <Checkbox
                                        checked={channels.length > 0 && selectedRows.length === channels.length}
                                        onCheckedChange={(checked) => setSelectedRows(checked ? channels.map(c => c.id) : [])}
                                    />
                                </TableHead>
                                <TableHead className="w-[60px] text-center">No.</TableHead>
                                <TableHead className="text-center">채널명</TableHead>
                                {/* 📍 수수료율 헤더 추가 */}
                                <TableHead className="text-center text-blue-700 font-bold">수수료율</TableHead>
                                <TableHead className="text-center">상태</TableHead>
                                <TableHead className="text-center">등록자</TableHead>
                                <TableHead className="text-center">등록일시</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-gray-900">
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="h-32 text-center">로딩 중...</TableCell></TableRow>
                            ) : channels.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-32 text-center">데이터가 없습니다.</TableCell></TableRow>
                            ) : (
                                channels.map((channel, idx) => (
                                    <TableRow
                                        key={channel.id}
                                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => { setSelectedChannel(channel); setIsModalOpen(true); }}
                                    >
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedRows.includes(channel.id)}
                                                onCheckedChange={(checked) => setSelectedRows(prev => checked ? [...prev, channel.id] : prev.filter(id => id !== channel.id))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">{(pagination.pageIndex - 1) * pagination.pageSize + idx + 1}</TableCell>
                                        <TableCell className="text-center font-bold text-gray-700">{channel.channel_name}</TableCell>

                                        {/* 📍 수수료율 셀 (0%이면 자사 배지 표시) */}
                                        <TableCell className="text-center">
                                            {channel.channel_fee_rate > 0 ? (
                                                <span className="font-semibold text-orange-600">{channel.channel_fee_rate}%</span>
                                            ) : (
                                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 font-bold">
                                                    🏠 자사
                                                </Badge>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <Badge variant={channel.status === '활성화' ? 'default' : 'secondary'}>{channel.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center text-xs text-gray-500">
                                            {channel.user_created?.first_name || '-'} {channel.user_created?.last_name || ''}
                                        </TableCell>
                                        <TableCell className="text-center text-xs text-gray-500">
                                            {new Date(channel.date_created).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* 하단 페이지네이션 */}
                <div className="p-3 border-t flex justify-center items-center gap-4 bg-white text-gray-900">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.pageIndex === 1}
                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }))}
                        className="bg-white"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">Page {pagination.pageIndex}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={channels.length < pagination.pageSize}
                        onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
                        className="bg-white"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* 모달 연동 */}
            <ChannelDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                channel={selectedChannel}
                onRefresh={fetchChannels}
            />
        </div>
    );
}