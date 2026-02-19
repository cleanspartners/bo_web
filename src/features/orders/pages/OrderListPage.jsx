import { useEffect, useState } from 'react';
import client from '@/lib/directus';
import { readItems, aggregate, updateItems, updateItem } from '@directus/sdk';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileInput, RotateCw, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Download, Check, ChevronsUpDown } from 'lucide-react';
import { readUsers } from '@directus/sdk';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import OrderDetailModal from '../components/OrderDetailModal';
import OrderImportModal from '../components/OrderImportModal';
import PartnerCombobox from '../components/PartnerCombobox';
import ChannelCombobox from '@/features/channels/components/ChannelCombobox';
import { Checkbox } from "@/components/ui/checkbox";

import { useOrderStatuses } from '../hooks/useOrderStatuses';

export default function OrderListPage() {
    const { statuses: ORDER_STATUSES } = useOrderStatuses();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [totalAmounts, setTotalAmounts] = useState({
        order_price: 0,
        rel_settlement_amount: 0,
        rel_commission_amount: 0
    });

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);

    // 날짜 계산 유틸리티
    const getToday = () => new Date().toISOString().split('T')[0];
    const getOneMonthLater = () => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date.toISOString().split('T')[0];
    };

    // 검색 필터 상태 (기본값 설정: 오늘 ~ 한 달 뒤)
    const [searchParams, setSearchParams] = useState({
        startDate: getToday(),
        endDate: getOneMonthLater(),
        status: '',
        partnerName: '', // Legacy support or just use partnerId
        partnerId: '', // New ID-based filter
        customerName: '',
        phone: '',
        address: '', // New Address filter
    });

    const [isSearchExpanded, setIsSearchExpanded] = useState(true);

    // Bulk Update State
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
    const [bulkUpdatePartnerId, setBulkUpdatePartnerId] = useState('');

    const [isBulkChannelUpdateOpen, setIsBulkChannelUpdateOpen] = useState(false);
    const [bulkUpdateChannelId, setBulkUpdateChannelId] = useState('');



    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [sort, setSort] = useState({ column: 'date_created', direction: 'desc' });

    useEffect(() => {
        fetchOrders();
    }, [page, limit, sort]);

    const fetchOrders = async () => {
        try {
            setLoading(true);

            // 필터 구성
            const filter = {
                _and: [
                    { del_yn: { _neq: 'Y' } } // 삭제되지 않은 데이터만 조회
                ]
            };

            if (searchParams.status && searchParams.status !== 'all') {
                filter._and.push({ status: { _eq: searchParams.status } });
            }
            if (searchParams.startDate) {
                filter._and.push({ order_date: { _gte: searchParams.startDate } });
            }
            if (searchParams.endDate) {
                filter._and.push({ order_date: { _lte: searchParams.endDate } });
            }
            if (searchParams.partnerId) {
                filter._and.push({ partner: { id: { _eq: searchParams.partnerId } } });
            } else if (searchParams.partnerName) {
                filter._and.push({ partner: { first_name: { _icontains: searchParams.partnerName.trim() } } });
            }
            if (searchParams.address) {
                filter._and.push({ address: { _icontains: searchParams.address.trim() } });
            }
            if (searchParams.customerName) {
                filter._and.push({ customer_name: { _icontains: searchParams.customerName.trim() } });
            }
            if (searchParams.phone) {
                filter._and.push({ phone: { _icontains: searchParams.phone.trim() } });
            }

            // 정렬 파라미터 구성
            const sortParam = [`${sort.direction === 'desc' ? '-' : ''}${sort.column}`];
            if (sort.column !== 'date_created') {
                sortParam.push('-date_created');
            }

            // 병렬로 데이터와 카운트 조회
            const [dataResponse, countResponse] = await Promise.all([
                client.request(readItems('ord_mstr', {
                    fields: [
                        '*',
                        'channel_name.channel_name',
                        'partner.first_name',
                        'partner.last_name',
                        'user_created.first_name',
                        'user_created.last_name',
                        'date_created',
                        'cstm_memo'
                    ],
                    filter: filter._and.length > 0 ? filter : {},
                    sort: sortParam,
                    limit: limit,
                    page: page
                })),
                client.request(aggregate('ord_mstr', {
                    aggregate: {
                        countDistinct: 'id',
                        sum: ['order_price', 'rel_settlement_amount', 'rel_commission_amount']
                    },
                    query: {
                        filter: filter._and.length > 0 ? filter : {}
                    }
                }))
            ]);

            setOrders(dataResponse || []);

            const count = countResponse?.[0]?.countDistinct?.id;
            const sums = countResponse?.[0]?.sum;

            setTotalCount(count ? Number(count) : 0);
            setTotalAmounts({
                order_price: sums?.order_price ? Number(sums.order_price) : 0,
                rel_settlement_amount: sums?.rel_settlement_amount ? Number(sums.rel_settlement_amount) : 0,
                rel_commission_amount: sums?.rel_commission_amount ? Number(sums.rel_commission_amount) : 0
            });

        } catch (error) {
            console.error("주문 목록 로드 실패:", error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (column) => {
        setSort(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchOrders();
    };

    const handleReset = () => {
        setSearchParams({
            startDate: getToday(),
            endDate: getOneMonthLater(),
            status: '',
            partnerName: '',
            partnerId: '',
            customerName: '',
            phone: '',
            address: '',
        });
        setPage(1);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= Math.ceil(totalCount / limit)) {
            setPage(newPage);
        }
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '-';
        return Number(amount).toLocaleString();
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    // 정렬 아이콘 렌더링 헬퍼
    const renderSortIcon = (column) => {
        if (sort.column !== column) {
            return <ArrowUpDown className="h-4 w-4 text-gray-400 opacity-50" />;
        }
        return sort.direction === 'asc'
            ? <ArrowUp className="h-4 w-4 text-blue-600" />
            : <ArrowDown className="h-4 w-4 text-blue-600" />;
    };

    const handleRowClick = (orderId) => {
        setSelectedOrderId(orderId);
        setIsModalOpen(true);
    };

    const handleOrderUpdate = () => {
        fetchOrders();
        setSelectedRows([]); // 목록 가져올 때 선택 초기화
    };

    // 전체 선택/해제
    const handleSelectAll = (checked) => {
        if (checked) {
            const allIds = orders.map(order => order.id);
            setSelectedRows(allIds);
        } else {
            setSelectedRows([]);
        }
    };

    // 개별 선택/해제
    const handleSelectRow = (id, checked) => {
        if (checked) {
            setSelectedRows(prev => [...prev, id]);
        } else {
            setSelectedRows(prev => prev.filter(rowId => rowId !== id));
        }
    };

    // 선택 삭제 (Soft Delete)
    const handleDeleteSelected = async () => {
        if (selectedRows.length === 0) {
            alert("삭제할 항목을 선택해주세요.");
            return;
        }

        if (!confirm(`선택한 ${selectedRows.length}개의 항목을 삭제하시겠습니까?`)) return;

        try {
            await client.request(updateItems('ord_mstr', selectedRows, {
                del_yn: 'Y'
            }));
            alert("삭제되었습니다.");
            fetchOrders();
            setSelectedRows([]);
        } catch (error) {
            console.error("삭제 실패:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    // 일괄 파트너 변경
    const handleBulkUpdatePartner = async () => {
        if (!bulkUpdatePartnerId) {
            alert('변경할 파트너를 선택해주세요.');
            return;
        }

        if (!window.confirm(`선택한 ${selectedRows.length}개의 주문 파트너를 변경하시겠습니까?`)) return;

        try {
            await Promise.all(selectedRows.map(id =>
                client.request(updateItem('ord_mstr', id, {
                    partner: bulkUpdatePartnerId
                }))
            ));
            alert('파트너 변경이 완료되었습니다.');
            setIsBulkUpdateOpen(false);
            setBulkUpdatePartnerId('');
            fetchOrders();
            setSelectedRows([]);
        } catch (error) {
            console.error('파트너 일괄 변경 실패:', error);
            alert('파트너 변경 중 오류가 발생했습니다.');
        }
    };

    const handleBulkUpdateChannel = async () => {
        if (!bulkUpdateChannelId) {
            alert('변경할 채널을 선택해주세요.');
            return;
        }

        if (!window.confirm(`선택한 ${selectedRows.length}개의 주문 채널을 변경하시겠습니까?`)) return;

        try {
            await Promise.all(selectedRows.map(id =>
                client.request(updateItem('ord_mstr', id, {
                    channel_name: bulkUpdateChannelId
                }))
            ));
            alert('채널 변경이 완료되었습니다.');
            setIsBulkChannelUpdateOpen(false);
            setBulkUpdateChannelId('');
            fetchOrders();
            setSelectedRows([]);
        } catch (error) {
            console.error('채널 일괄 변경 실패:', error);
            alert('채널 변경 중 오류가 발생했습니다.');
        }
    };

    // 등록 버튼 핸들러
    const handleRegister = () => {
        setSelectedOrderId(null);
        setIsModalOpen(true);
    };

    const handleExcelDownload = () => {
        const excelData = orders.map((order, index) => ({
            'No.': index + 1,
            '고객명': order.customer_name,
            '요청날짜': order.order_date?.split('T')[0],
            '서비스항목': order.service_type,
            '작업상태': order.status,
            '파트너': order.partner?.first_name || '-',
            '팀장명': order.partner?.last_name || '-',
            '수수료구분': order.commission_type || '-',
            '판매금액': order.order_price,
            '수수료': order.commission_type === '비율' ? `${order.commission || 0}%` : (order.commission || 0),
            '정산금액': order.rel_settlement_amount,
            '수수료금액': order.rel_commission_amount,
            '작성일시': order.date_created ? new Date(order.date_created).toLocaleString() : '-'
        }));

        // 합계 행 추가
        excelData.push({
            'No.': '합계',
            '고객명': '',
            '요청날짜': '',
            '서비스항목': '',
            '작업상태': '',
            '파트너': '',
            '팀장명': '',
            '수수료구분': '',
            '판매금액': totalAmounts.order_price, // 숫자 자체로 저장 (엑셀 서식 적용 가능)
            '수수료': '',
            '정산금액': totalAmounts.rel_settlement_amount,
            '수수료금액': totalAmounts.rel_commission_amount,
            '작성일시': ''
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
        XLSX.writeFile(workbook, `Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="space-y-4 p-4 bg-gray-50 flex flex-col h-auto md:h-full">
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
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">요청날짜</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={searchParams.startDate}
                                        onChange={(e) => setSearchParams({ ...searchParams, startDate: e.target.value })}
                                    />
                                    <span className="text-gray-400 shrink-0">~</span>
                                    <input
                                        type="date"
                                        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={searchParams.endDate}
                                        onChange={(e) => setSearchParams({ ...searchParams, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">작업상태</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                    value={searchParams.status}
                                    onChange={(e) => setSearchParams({ ...searchParams, status: e.target.value })}
                                >
                                    <option value="">전체</option>
                                    {ORDER_STATUSES.map(statusObj => (
                                        <option key={statusObj.value} value={statusObj.value}>{statusObj.text}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">파트너명</label>
                                <PartnerCombobox
                                    value={searchParams.partnerId}
                                    onChange={(val) => setSearchParams({ ...searchParams, partnerId: val, partnerName: '' })}
                                />
                            </div>



                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">고객명</label>
                                <input
                                    type="text"
                                    placeholder="고객명"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={searchParams.customerName}
                                    onChange={(e) => setSearchParams({ ...searchParams, customerName: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">연락처</label>
                                <input
                                    type="text"
                                    placeholder="연락처"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={searchParams.phone}
                                    onChange={(e) => setSearchParams({ ...searchParams, phone: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">주소</label>
                                <input
                                    type="text"
                                    placeholder="주소"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={searchParams.address}
                                    onChange={(e) => setSearchParams({ ...searchParams, address: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-center gap-2 mt-4 border-t pt-4 col-span-full">
                            <Button type="button" variant="outline" onClick={handleReset} className="w-24">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                초기화
                            </Button>
                            <Button type="submit" onClick={handleSearch} className="w-24 bg-blue-600 hover:bg-blue-700">
                                <Search className="mr-2 h-4 w-4" />
                                검색
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-[500px] md:min-h-0">
                <div className="p-3 border-b flex flex-col sm:flex-row justify-between items-center gap-2 bg-gray-50/50">
                    <div className="text-sm font-medium text-gray-600 w-full sm:w-auto text-center sm:text-left">
                        총 <span className="text-blue-600 font-bold">{totalCount}</span> 건
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
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white border-transparent"
                            onClick={() => setIsBulkUpdateOpen(true)}
                            disabled={selectedRows.length === 0}
                        >
                            파트너 일괄 변경
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white border-transparent"
                            onClick={() => setIsBulkChannelUpdateOpen(true)}
                            disabled={selectedRows.length === 0}
                        >
                            채널 일괄 변경
                        </Button>
                        <Button
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                            onClick={handleRegister}
                        >
                            + 신규 등록
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent"
                            onClick={() => setIsImportModalOpen(true)}
                        >
                            EXCEL 가져오기
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto h-8 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent"
                            onClick={handleExcelDownload}
                        >
                            <Download className="w-3 h-3 mr-1" /> EXCEL 다운로드
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-100 z-10 shadow-sm">
                            <TableRow className="bg-gray-100 hover:bg-gray-100 text-xs text-gray-600 font-semibold whitespace-nowrap">
                                <TableHead className="w-[30px] text-center">
                                    <Checkbox
                                        checked={orders.length > 0 && selectedRows.length === orders.length}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[50px] text-center">No.</TableHead>
                                <TableHead className="w-[100px] text-center">고객명</TableHead>
                                <TableHead
                                    className="w-[120px] text-center cursor-pointer hover:bg-gray-200 transition-colors group"
                                    onClick={() => handleSort('order_date')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        요청날짜
                                        {renderSortIcon('order_date')}
                                    </div>
                                </TableHead>
                                <TableHead className="w-[150px] text-center">주소</TableHead>
                                <TableHead className="w-[120px] text-center">서비스항목</TableHead>
                                <TableHead className="w-[80px] text-center">작업상태</TableHead>
                                <TableHead className="w-[100px] text-center">파트너</TableHead>
                                <TableHead className="w-[100px] text-center">팀장명</TableHead>
                                <TableHead className="w-[100px] text-center">수수료구분</TableHead>
                                <TableHead className="w-[120px] text-right">판매금액</TableHead>
                                <TableHead className="w-[120px] text-right">수수료</TableHead>
                                <TableHead className="w-[120px] text-right">정산금액</TableHead>
                                <TableHead className="w-[120px] text-right">수수료금액</TableHead>
                                <TableHead
                                    className="w-[150px] text-center cursor-pointer hover:bg-gray-200 transition-colors group"
                                    onClick={() => handleSort('date_created')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        작성일시
                                        {renderSortIcon('date_created')}
                                    </div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={15} className="h-32 text-center text-gray-500">
                                        데이터를 불러오는 중입니다...
                                    </TableCell>
                                </TableRow>
                            ) : orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={15} className="h-32 text-center text-gray-500">
                                        검색 결과가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order, index) => (
                                    <TableRow
                                        key={order.id}
                                        className="hover:bg-blue-50/50 cursor-pointer transition-colors text-xs"
                                    >
                                        <TableCell className="text-center p-2">
                                            <Checkbox
                                                checked={selectedRows.includes(order.id)}
                                                onCheckedChange={(checked) => handleSelectRow(order.id, checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500" onClick={() => handleRowClick(order.id)}>{totalCount - ((page - 1) * limit) - index}</TableCell>
                                        <TableCell className="text-center font-medium text-gray-900" onClick={() => handleRowClick(order.id)}>{order.customer_name}</TableCell>
                                        <TableCell className="text-center" onClick={() => handleRowClick(order.id)}>{order.order_date?.split('T')[0]}</TableCell>
                                        <TableCell className="text-center truncate max-w-[150px]" title={order.address} onClick={() => handleRowClick(order.id)}>{order.address || '-'}</TableCell>
                                        <TableCell className="text-center" onClick={() => handleRowClick(order.id)}>{order.service_type}</TableCell>
                                        <TableCell className="text-center" onClick={() => handleRowClick(order.id)}>
                                            <Badge variant="outline" className={`bg-white whitespace-nowrap text-[10px] px-2 py-0.5 ${order.status === '접수' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                                                order.status === 'AS접수' ? 'text-pink-600 border-pink-200 bg-pink-50' :
                                                    order.status === '작업보류' ? 'text-orange-600 border-orange-200 bg-orange-50' :
                                                        order.status === '예약진행' ? 'text-violet-600 border-violet-200 bg-violet-50' :
                                                            order.status === '처리완료' ? 'text-green-600 border-green-200 bg-green-50' :
                                                                order.status === '접수취소' ? 'text-red-600 border-red-200 bg-red-50' :
                                                                    'text-gray-600 border-gray-200 bg-gray-50'
                                                }`}>
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center" onClick={() => handleRowClick(order.id)}>{order.partner?.first_name || '-'}</TableCell>
                                        <TableCell className="text-center" onClick={() => handleRowClick(order.id)}>{order.partner?.last_name || '-'}</TableCell>
                                        <TableCell className="text-center" onClick={() => handleRowClick(order.id)}>{order.commission_type || '-'}</TableCell>
                                        <TableCell className="text-right font-medium text-blue-600" onClick={() => handleRowClick(order.id)}>{formatCurrency(order.order_price)}</TableCell>
                                        <TableCell className="text-right" onClick={() => handleRowClick(order.id)}>
                                            {order.commission_type === '비율'
                                                ? `${order.commission || 0}%`
                                                : (order.commission || 0).toLocaleString()
                                            }
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">{formatCurrency(order.rel_settlement_amount)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(order.rel_commission_amount)}</TableCell>
                                        <TableCell className="text-center text-gray-500">{formatDate(order.date_created)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter className="bg-gray-50 border-t-2 border-gray-200">
                            <TableRow className="hover:bg-gray-50 font-bold text-gray-700">
                                <TableCell colSpan={10} className="text-center">합계</TableCell>
                                <TableCell className="text-right text-blue-600">{formatCurrency(totalAmounts.order_price)}</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right text-red-600">{formatCurrency(totalAmounts.rel_settlement_amount)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalAmounts.rel_commission_amount)}</TableCell>
                                <TableCell className="text-center">-</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                <div className="p-3 border-t flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Size</span>
                        <select
                            className="text-xs border border-gray-300 rounded px-1 py-1 outline-none focus:border-blue-500"
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(1)} disabled={page === 1}>
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                        <span className="text-sm font-medium text-gray-600">
                            Page {page} of {Math.ceil(totalCount / limit) || 1}
                        </span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(page + 1)} disabled={page >= Math.ceil(totalCount / limit)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(Math.ceil(totalCount / limit))} disabled={page >= Math.ceil(totalCount / limit)}>
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>


            <OrderDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                orderId={selectedOrderId}
                onUpdate={handleOrderUpdate}
            />

            <OrderImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onUpdate={handleOrderUpdate}
            />

            <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>파트너 일괄 변경</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-2">변경할 파트너 선택</label>
                        <PartnerCombobox
                            value={bulkUpdatePartnerId}
                            onChange={(val) => setBulkUpdatePartnerId(val)}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            선택한 {selectedRows.length}개의 주문에 대해 파트너를 변경합니다.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkUpdateOpen(false)}>취소</Button>
                        <Button onClick={handleBulkUpdatePartner} className="bg-blue-600 hover:bg-blue-700">변경하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBulkChannelUpdateOpen} onOpenChange={setIsBulkChannelUpdateOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>채널 일괄 변경</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-2">변경할 채널 선택</label>
                        <ChannelCombobox
                            value={bulkUpdateChannelId}
                            onChange={(val) => setBulkUpdateChannelId(val)}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            선택한 {selectedRows.length}개의 주문에 대해 채널을 변경합니다.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkChannelUpdateOpen(false)}>취소</Button>
                        <Button onClick={handleBulkUpdateChannel} className="bg-indigo-600 hover:bg-indigo-700">변경하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
