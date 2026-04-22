import { useEffect, useState, useCallback } from 'react';
import client from '@/lib/directus';
import { readItems, updateItem, createItem } from '@directus/sdk';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, RotateCw, ChevronLeft, ChevronRight, Trash2, Calendar, User, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import RequestDetailModal from '../components/RequestDetailModal';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRequestOptions } from '../hooks/useRequestOptions';

const LIMIT = 15;

// 스타일 매핑용 정보 (라벨은 DB에서 가져옴)
const STATUS_STYLE_MAP = {
    'published': 'bg-blue-100 text-blue-700 border-blue-200',
    'progress': 'bg-orange-100 text-orange-700 border-orange-200',
    'completed': 'bg-green-100 text-green-700 border-green-200',
    'rejected': 'bg-red-100 text-red-700 border-red-200'
};

export default function RequestListPage() {
    const { statuses, types } = useRequestOptions();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    
    // 필터 상태
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("전체");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [sort, setSort] = useState({ column: 'date_created', direction: 'desc' });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(true);

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const filter = {
                _and: [{ del_yn: { _neq: 'Y' } }]
            };

            if (statusFilter) {
                filter._and.push({ status: { _eq: statusFilter } });
            }
            if (typeFilter !== "전체") {
                filter._and.push({ type: { _eq: typeFilter } });
            }
            if (searchTerm) {
                filter._and.push({
                    _or: [
                        { rqst_cont: { _icontains: searchTerm } },
                        { user_created: { first_name: { _icontains: searchTerm } } },
                        { user_created: { last_name: { _icontains: searchTerm } } }
                    ]
                });
            }
            if (startDate) {
                filter._and.push({ rqst_dt: { _gte: startDate } });
            }
            if (endDate) {
                // 종료일 포함을 위해 다음날 00:00보다 작음(<)으로 조회
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1);
                filter._and.push({ rqst_dt: { _lt: end.toISOString().split('T')[0] } });
            }

            const response = await client.request(readItems('rqst_mstr', {
                fields: [
                    '*',
                    'user_created.first_name',
                    'user_created.last_name',
                    { rqst_ans_list: ['id'] }
                ],
                filter: filter._and.length > 0 ? filter : {},
                sort: [`${sort.direction === 'desc' ? '-' : ''}${sort.column}`],
                limit: LIMIT,
                page: page,
                meta: 'filter_count'
            }));

            // 📍 응답 형태(배열 vs 객체)에 상관없이 데이터 추출
            const dataItems = Array.isArray(response) ? response : (response.data || []);
            const count = Array.isArray(response) ? response.length : (response.meta?.filter_count || dataItems.length);

            setRequests(dataItems);
            setTotalCount(count);
        } catch (error) {
            console.error("요청 목록 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, typeFilter, startDate, endDate, searchTerm, sort]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleRowClick = (id) => {
        setSelectedRequestId(id);
        setIsModalOpen(true);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // 모달 오픈 방지
        if (!window.confirm("정말로 이 요청을 삭제하시겠습니까? (목록에서 제외됩니다)")) return;
        try {
            await client.request(updateItem('rqst_mstr', id, { del_yn: 'Y' }));
            alert("삭제되었습니다.");
            fetchRequests();
        } catch (error) {
            console.error("삭제 실패:", error);
            alert("삭제 처리 중 오류가 발생했습니다.");
        }
    };

    const getStatusInfo = (statusValue) => {
        const option = statuses.find(s => s.value === statusValue);
        return {
            text: option ? option.text : statusValue,
            color: STATUS_STYLE_MAP[statusValue] || 'bg-gray-100 text-gray-700'
        };
    };

    const totalPages = Math.ceil(totalCount / LIMIT);

    const handleSort = (column) => {
        setSort(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
        setPage(1);
    };

    const renderSortIcon = (column) => {
        if (sort.column !== column) {
            return <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-50" />;
        }
        return sort.direction === 'desc' 
            ? <ArrowDown className="h-3 w-3 text-blue-600" /> 
            : <ArrowUp className="h-3 w-3 text-blue-600" />;
    };

    return (
        <div className="space-y-4">
            {/* 검색 및 필터 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-4">
                <div 
                    className="p-4 border-b bg-white flex justify-between items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">조회 조건</h2>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-gray-100">
                        {isSearchExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </Button>
                </div>

                {isSearchExpanded && (
                    <div className="p-4 border-b border-gray-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {/* Row 1: 기간 검색 (2열 차지) */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-0.5">요청일자 기간</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date"
                                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={startDate}
                                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                    />
                                    <span className="text-gray-300 font-medium">~</span>
                                    <input 
                                        type="date"
                                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={endDate}
                                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                    />
                                </div>
                            </div>

                            {/* Row 2: 상태 및 유형 (각 1열) */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-500 ml-0.5">처리 상태</label>
                                <select 
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white transition-all appearance-none"
                                    value={statusFilter}
                                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                >
                                    <option value="">전체 상태</option>
                                    {statuses.map(s => <option key={s.value} value={s.value}>{s.text}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-500 ml-0.5">요청 유형</label>
                                <select 
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white transition-all appearance-none"
                                    value={typeFilter}
                                    onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                                >
                                    <option value="전체">전체 유형</option>
                                    {types.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
                                </select>
                            </div>
                            
                            {/* Row 3: 전체 검색 (2열 차지) */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-0.5">통합 검색 (내용, 작성자)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="검색어를 입력하고 엔터를 누르세요..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && setPage(1)}
                                        />
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => { setPage(1); fetchRequests(); }}
                                        className="rounded-xl border-gray-200 hover:bg-gray-50 h-[38px] px-4"
                                    >
                                        <RotateCw className="w-4 h-4 text-gray-500" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 테이블 및 리스트 영역 */}
            <div className="bg-white md:bg-transparent rounded-lg md:rounded-none border md:border-none border-gray-200 shadow-sm md:shadow-none overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center md:hidden">
                    <span className="text-sm font-medium text-gray-600">전체 <span className="text-blue-600 font-bold">{totalCount}</span> 건</span>
                </div>

                {/* 모바일 리스트 (md 미만에서 노출) */}
                <div className="md:hidden p-4 space-y-4 bg-gray-50/50">
                    {loading ? (
                        <div className="h-40 flex items-center justify-center text-gray-400">데이터를 불러오는 중입니다...</div>
                    ) : requests.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-gray-400">조회된 요청이 없습니다.</div>
                    ) : (
                        requests.map((req, index) => {
                            const statusInfo = getStatusInfo(req.status);
                            return (
                                <div 
                                    key={req.id}
                                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm active:ring-2 active:ring-blue-500 transition-all"
                                    onClick={() => handleRowClick(req.id)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3 h-3 text-blue-500" />
                                                <span className="text-[13px] font-extrabold text-blue-600">요청일: {req.rqst_dt ? req.rqst_dt.split('T')[0] : '-'}</span>
                                            </div>
                                            <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-400">{req.type}</Badge>
                                        </div>
                                        <Badge className={`${statusInfo.color} font-bold text-[10px] px-2 py-0.5`}>{statusInfo.text}</Badge>
                                    </div>

                                    <p className="text-sm text-gray-800 line-clamp-2 font-medium mb-4 leading-relaxed min-h-[40px]">
                                        {req.rqst_cont}
                                    </p>

                                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                            <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400 capitalize">
                                                {req.user_created?.first_name?.charAt(0) || 'P'}
                                            </div>
                                            {req.user_created?.first_name || ''} {req.user_created?.last_name || '파트너'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {req.rqst_ans_list?.length > 0 && (
                                                <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                                                    <MessageSquare className="w-2.5 h-2.5" />
                                                    {req.rqst_ans_list.length}
                                                </div>
                                            )}
                                            <button 
                                                onClick={(e) => handleDelete(e, req.id)}
                                                className="p-1.5 text-gray-300 hover:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 데스크탑 테이블 (md 이상에서 노출) */}
                <div className="hidden md:block bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">전체 <span className="text-blue-600 font-bold">{totalCount}</span> 건</span>
                    </div>
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow className="bg-gray-100/50 hover:bg-gray-100/50">
                            <TableHead className="w-[60px] text-center">No.</TableHead>
                            <TableHead 
                                className="w-[120px] text-center cursor-pointer hover:bg-gray-200 transition-colors group"
                                onClick={() => handleSort('rqst_dt')}
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    요청일
                                    {renderSortIcon('rqst_dt')}
                                </div>
                            </TableHead>
                            <TableHead className="w-[120px] text-center">유형</TableHead>
                            <TableHead className="w-[100px] text-center">상태</TableHead>
                            <TableHead className="text-left">요청 내용</TableHead>
                            <TableHead className="w-[150px] text-center">작성자</TableHead>
                            <TableHead 
                                className="w-[180px] text-center cursor-pointer hover:bg-gray-200 transition-colors group"
                                onClick={() => handleSort('date_created')}
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    작성일시
                                    {renderSortIcon('date_created')}
                                </div>
                            </TableHead>
                            <TableHead className="w-[80px] text-center">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-40 text-center text-gray-400">데이터를 불러오는 중입니다...</TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-40 text-center text-gray-400">조회된 요청이 없습니다.</TableCell>
                            </TableRow>
                        ) : (
                            requests.map((req, index) => {
                                const statusInfo = getStatusInfo(req.status);
                                return (
                                    <TableRow 
                                        key={req.id} 
                                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => handleRowClick(req.id)}
                                    >
                                        <TableCell className="text-center text-gray-500">{totalCount - (page - 1) * LIMIT - index}</TableCell>
                                        <TableCell className="text-center font-bold text-gray-900">{req.rqst_dt ? req.rqst_dt.split('T')[0] : '-'}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-medium">{req.type}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={`${statusInfo.color} font-bold`}>{statusInfo.text}</Badge>
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate max-w-[400px] font-medium text-gray-800">{req.rqst_cont}</span>
                                                {req.rqst_ans_list?.length > 0 && (
                                                    <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                                                        {req.rqst_ans_list.length}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-medium">
                                            {req.user_created?.first_name || ''} {req.user_created?.last_name || '파트너'}
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500 text-xs">
                                            {req.date_created ? format(parseISO(req.date_created), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <button 
                                                onClick={(e) => handleDelete(e, req.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                    <div className="p-4 border-t flex items-center justify-center gap-2 bg-gray-50">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                            <span className="text-blue-600">{page}</span> / {totalPages}
                        </span>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* 상세 모달 */}
            <RequestDetailModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                requestId={selectedRequestId}
                onUpdate={fetchRequests}
            />
        </div>
    );
}
