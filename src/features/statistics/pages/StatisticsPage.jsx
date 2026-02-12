import { useState, useEffect, useMemo } from 'react';
import client from '@/lib/directus';
import { readItems, aggregate } from '@directus/sdk';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function StatisticsPage() {
    const getToday = () => new Date().toISOString().split('T')[0];
    const getFirstDayOfMonth = () => {
        const date = new Date();
        date.setDate(1);
        return date.toISOString().split('T')[0];
    };

    const [dateRange, setDateRange] = useState({
        startDate: getFirstDayOfMonth(),
        endDate: getToday()
    });

    // Helper: Normalize Region
    const normalizeRegion = (address) => {
        if (!address) return '기타';
        const parts = address.trim().split(/\s+/);

        // 1. Check for Metro Cities (Do/Si level that stands alone or is the main grouper)
        const metroCities = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주'];
        const provinceMap = {
            '경기': '경기', '강원': '강원', '충북': '충북', '충남': '충남',
            '전북': '전북', '전남': '전남', '경북': '경북', '경남': '경남'
        };

        let city = parts[0];
        let district = parts[1] || '';

        // Handle special cases where 'Seoul' might be written as '서울특별시' etc. (Assumed cleaned by DB or simple matching)
        // For this logic, we assume standard short names or we do simple "startsWith"
        const matchedMetro = metroCities.find(m => city.startsWith(m));
        if (matchedMetro) city = matchedMetro;

        // Simplify Province names if needed (e.g. 경기도 -> 경기)
        const matchedProvince = Object.keys(provinceMap).find(p => city.startsWith(p));
        if (matchedProvince) city = matchedProvince;

        // Logic: If 2nd part ends in 'Gu', preserve it. 
        if (district.endsWith('구')) {
            return `${city} ${district}`;
        }

        // If 2nd part is Gun/Si in Provinces
        if (matchedProvince && (district.endsWith('시') || district.endsWith('군'))) {
            return `${city} ${district}`;
        }

        // Fallback for Metro cities without 'Gu' suffix in 2nd part (e.g. "Seoul Gangnam") -> Append 'gu' if likely? 
        // Or just trust the input is "City District".
        if (matchedMetro && district) {
            // E.g. "서울 금천" -> "서울 금천구" normalization
            // Common districts map could be added here for stricter normalization
            if (!district.endsWith('구') && !district.endsWith('군')) {
                return `${city} ${district}구`; // Naive approach requested by user ("Seoul Geumcheon" -> "Geumcheon-gu")
            }
            return `${city} ${district}`;
        }

        // Default: City only if no district, or City+District
        if (!district) return city;

        return `${city} ${district}`;
    };

    // Reusable Pagination Table Component
    const PaginationTable = ({ data, columns, defaultItemsPerPage = 10, emptyMessage = "데이터가 없습니다.", footer }) => {
        const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
        const [currentPage, setCurrentPage] = useState(1);
        const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

        const totalPages = Math.ceil(data.length / itemsPerPage);

        // Sort data
        const sortedData = useMemo(() => {
            if (!sortConfig.key) return data;

            const sorted = [...data].sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal === bVal) return 0;
                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }

                return sortConfig.direction === 'asc'
                    ? String(aVal).localeCompare(String(bVal))
                    : String(bVal).localeCompare(String(aVal));
            });

            return sorted;
        }, [data, sortConfig]);

        const currentData = useMemo(() => {
            const start = (currentPage - 1) * itemsPerPage;
            return sortedData.slice(start, start + itemsPerPage);
        }, [sortedData, currentPage, itemsPerPage]);

        // Reset to page 1 if data changes significantly or page size changes
        useEffect(() => {
            setCurrentPage(1);
        }, [data.length, itemsPerPage]);

        const handleSort = (accessor) => {
            if (!accessor) return; // Skip if column is not sortable

            setSortConfig(prev => ({
                key: accessor,
                direction: prev.key === accessor && prev.direction === 'asc' ? 'desc' : 'asc'
            }));
        };

        return (
            <div className="rounded-md border border-gray-200 overflow-hidden mt-4 flex flex-col bg-white">
                {/* Table Header / Controls */}
                <div className="p-2 border-b border-gray-100 flex justify-end">
                    <select
                        className="text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    >
                        <option value={5}>5개씩 보기</option>
                        <option value={10}>10개씩 보기</option>
                        <option value={20}>20개씩 보기</option>
                        <option value={50}>50개씩 보기</option>
                        <option value={100}>100개씩 보기</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap table-fixed">
                        <thead className="bg-gray-100 text-gray-700 font-medium">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        className={`px-4 py-3 border-b ${col.className || ''} ${col.width || 'w-auto'} ${col.accessor ? 'cursor-pointer hover:bg-gray-200 select-none' : ''}`}
                                        onClick={() => handleSort(col.accessor)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.header}
                                            {col.accessor && sortConfig.key === col.accessor && (
                                                <span className="text-blue-600">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentData.length > 0 ? (
                                currentData.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-gray-50">
                                        {columns.map((col, cIdx) => (
                                            <td key={cIdx} className={`px-4 py-3 ${col.cellClassName || ''} truncate`}>
                                                {col.render ? col.render(row, (currentPage - 1) * itemsPerPage + rIdx) : row[col.accessor]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {footer && (
                            <tfoot className="bg-gray-50 font-bold text-gray-700 border-t-2 border-gray-200">
                                {footer}
                            </tfoot>
                        )}
                    </table>
                </div >
                {/* Pagination Controls */}
                {
                    totalPages > 1 && (
                        <div className="flex justify-center items-center py-4 gap-2 border-t border-gray-100 bg-white">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0"
                            >
                                &lt;
                            </Button>
                            <span className="text-sm text-gray-600">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="h-8 w-8 p-0"
                            >
                                &gt;
                            </Button>
                        </div>
                    )
                }
            </div >
        );
    };



    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('partner');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const filter = {
                _and: [
                    { del_yn: { _neq: 'Y' } },
                    { order_date: { _gte: dateRange.startDate } },
                    { order_date: { _lte: dateRange.endDate } }
                ]
            };

            const response = await client.request(readItems('ord_mstr', {
                fields: [
                    'id', 'order_price', 'rel_settlement_amount', 'rel_commission_amount',
                    'channel_name.channel_name',
                    'partner.first_name', 'partner.last_name',
                    'address', 'order_date' // Removed 'status' as it is not used in stats
                ],
                filter: filter,
                limit: -1
            }));
            setOrders(response);
        } catch (error) {
            console.error("통계 데이터 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');


    // --- Aggregation Logic ---

    // 1. Partner (Company) Stats - Server-side aggregate
    const [partnerStats, setPartnerStats] = useState([]);

    const fetchPartnerStats = async () => {
        try {
            const endDateObj = new Date(dateRange.endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const nextDay = endDateObj.toISOString().split('T')[0];

            // Step 1: Aggregate by partner (ID)
            const partnerAggResponse = await client.request(
                aggregate('ord_mstr', {
                    aggregate: {
                        count: '*',
                        sum: ['order_price', 'rel_settlement_amount', 'rel_commission_amount']
                    },
                    groupBy: ['partner'],
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: dateRange.startDate } },
                                { order_date: { _lt: nextDay } }
                            ]
                        }
                    }
                })
            );

            // Step 2: Get unique partner IDs
            const partnerIds = (partnerAggResponse || [])
                .map(item => item.partner)
                .filter(id => id != null);

            // Step 3: Fetch partner details from ord_mstr (with partner relation)
            let partnerMap = {};
            if (partnerIds.length > 0) {
                const ordersWithPartner = await client.request(
                    readItems('ord_mstr', {
                        fields: ['partner.id', 'partner.first_name', 'partner.last_name'],
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: dateRange.startDate } },
                                { order_date: { _lt: nextDay } },
                                { partner: { _in: partnerIds } }
                            ]
                        },
                        limit: -1
                    })
                );

                // Create unique partner map
                const uniquePartners = new Map();
                (ordersWithPartner || []).forEach(order => {
                    if (order.partner && !uniquePartners.has(order.partner.id)) {
                        uniquePartners.set(order.partner.id, {
                            companyName: order.partner.first_name,
                            teamLeader: order.partner.last_name
                        });
                    }
                });
                partnerMap = Object.fromEntries(uniquePartners);
            }

            // Step 4: Fetch addresses for region aggregation (minimal data)
            const partnerRegions = {};
            if (partnerIds.length > 0) {
                const addressResponse = await client.request(
                    readItems('ord_mstr', {
                        fields: ['partner', 'address'],
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: dateRange.startDate } },
                                { order_date: { _lt: nextDay } },
                                { partner: { _in: partnerIds } }
                            ]
                        },
                        limit: -1
                    })
                );

                // Aggregate regions by partner
                (addressResponse || []).forEach(order => {
                    const partnerId = order.partner;
                    const region = normalizeRegion(order.address);
                    if (!partnerRegions[partnerId]) {
                        partnerRegions[partnerId] = new Set();
                    }
                    if (region) partnerRegions[partnerId].add(region);
                });
            }

            // Step 5: Map IDs to names and combine data
            const partnerData = (partnerAggResponse || [])
                .map(item => {
                    const partner = partnerMap[item.partner] || { companyName: '미지정', teamLeader: '' };
                    const regions = partnerRegions[item.partner] || new Set();
                    const name = `${partner.companyName}(${partner.teamLeader})`;

                    return {
                        name,
                        companyName: partner.companyName,
                        teamLeader: partner.teamLeader,
                        count: Number(item.count || 0),
                        amount: Number(item.sum?.order_price || 0),
                        settlementAmount: Number(item.sum?.rel_settlement_amount || 0),
                        commissionAmount: Number(item.sum?.rel_commission_amount || 0),
                        regionDisplay: Array.from(regions).join(', ')
                    };
                })
                .sort((a, b) => b.amount - a.amount);

            setPartnerStats(partnerData);

        } catch (error) {
            console.error('파트너별 통계 로드 실패:', error);
        }
    };

    // 파트너별 탭은 기본 탭이므로 페이지 로드 시 조회
    useEffect(() => {
        fetchPartnerStats();
    }, [dateRange]);

    // 파트너별 검색 필터링 (클라이언트 측)
    const filteredPartnerStats = useMemo(() => {
        if (!searchTerm || activeTab !== 'partner') return partnerStats;
        const lowerTerm = searchTerm.toLowerCase();
        return partnerStats.filter(stat =>
            stat.companyName.toLowerCase().includes(lowerTerm) ||
            stat.teamLeader.toLowerCase().includes(lowerTerm) ||
            stat.regionDisplay.toLowerCase().includes(lowerTerm)
        );
    }, [partnerStats, searchTerm, activeTab]);

    // 2. Region Stats - Chart & Table (Server-side fetch with minimal data)
    const [regionStats, setRegionStats] = useState([]);
    const [regionPartnerStats, setRegionPartnerStats] = useState([]);

    const fetchRegionStats = async () => {
        try {
            const endDateObj = new Date(dateRange.endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const nextDay = endDateObj.toISOString().split('T')[0];

            // Fetch minimal data (address, partner, amounts)
            const regionResponse = await client.request(
                readItems('ord_mstr', {
                    fields: [
                        'address',
                        'partner.first_name',
                        'partner.last_name',
                        'order_price',
                        'rel_settlement_amount',
                        'rel_commission_amount'
                    ],
                    filter: {
                        _and: [
                            { del_yn: { _neq: 'Y' } },
                            { order_date: { _gte: dateRange.startDate } },
                            { order_date: { _lt: nextDay } }
                        ]
                    },
                    limit: -1
                })
            );

            // Client-side aggregation by region (for chart)
            const regionMap = {};
            (regionResponse || []).forEach(order => {
                const region = normalizeRegion(order.address);
                if (!regionMap[region]) {
                    regionMap[region] = { name: region, count: 0, amount: 0 };
                }
                regionMap[region].count += 1;
                regionMap[region].amount += Number(order.order_price || 0);
            });

            const regionData = Object.values(regionMap)
                .sort((a, b) => b.count - a.count);
            setRegionStats(regionData);

            // Client-side aggregation by region + partner (for table)
            const regionPartnerMap = {};
            (regionResponse || []).forEach(order => {
                const region = normalizeRegion(order.address);
                const partnerName = order.partner?.first_name || '미지정';
                const teamLeader = order.partner?.last_name || '';
                const key = `${region}|${partnerName}|${teamLeader}`;

                if (!regionPartnerMap[key]) {
                    regionPartnerMap[key] = {
                        region,
                        partnerName,
                        teamLeader,
                        count: 0,
                        amount: 0,
                        settlementAmount: 0,
                        commissionAmount: 0
                    };
                }
                regionPartnerMap[key].count += 1;
                regionPartnerMap[key].amount += Number(order.order_price || 0);
                regionPartnerMap[key].settlementAmount += Number(order.rel_settlement_amount || 0);
                regionPartnerMap[key].commissionAmount += Number(order.rel_commission_amount || 0);
            });

            const regionPartnerData = Object.values(regionPartnerMap)
                .sort((a, b) => {
                    if (a.region !== b.region) return a.region.localeCompare(b.region);
                    return b.amount - a.amount;
                });
            setRegionPartnerStats(regionPartnerData);

        } catch (error) {
            console.error('지역별 통계 로드 실패:', error);
        }
    };

    // 지역별 탭 활성화 시에만 조회
    useEffect(() => {
        if (activeTab === 'region') {
            fetchRegionStats();
        }
    }, [activeTab, dateRange]);

    // 지역별 검색 필터링 (클라이언트 측)
    const filteredRegionPartnerStats = useMemo(() => {
        if (!searchTerm || activeTab !== 'region') return regionPartnerStats;
        const lowerTerm = searchTerm.toLowerCase();
        return regionPartnerStats.filter(stat =>
            stat.region.toLowerCase().includes(lowerTerm) ||
            stat.partnerName.toLowerCase().includes(lowerTerm) ||
            stat.teamLeader.toLowerCase().includes(lowerTerm)
        );
    }, [regionPartnerStats, searchTerm, activeTab]);

    const filteredRegionStats = useMemo(() => {
        if (!searchTerm || activeTab !== 'region') return regionStats;

        // 파트너별 필터링 결과에서 지역별로 재집계
        const regionMap = {};
        filteredRegionPartnerStats.forEach(stat => {
            if (!regionMap[stat.region]) {
                regionMap[stat.region] = { name: stat.region, count: 0, amount: 0 };
            }
            regionMap[stat.region].count += stat.count;
            regionMap[stat.region].amount += stat.amount;
        });

        return Object.values(regionMap).sort((a, b) => b.count - a.count);
    }, [regionStats, filteredRegionPartnerStats, searchTerm, activeTab]);



    // 3. Channel Stats - Chart & Table (Server-side aggregate)
    const [channelStats, setChannelStats] = useState([]);
    const [channelPartnerStats, setChannelPartnerStats] = useState([]);

    const fetchChannelStats = async () => {
        try {
            const endDateObj = new Date(dateRange.endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const nextDay = endDateObj.toISOString().split('T')[0];

            // Step 1: Aggregate by channel_name (ID) - 서버 측 집계
            const channelAggResponse = await client.request(
                aggregate('ord_mstr', {
                    aggregate: {
                        count: '*'
                    },
                    groupBy: ['channel_name'],
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: dateRange.startDate } },
                                { order_date: { _lt: nextDay } }
                            ]
                        }
                    }
                })
            );

            // Step 2: 채널 ID 목록 추출
            const channelIds = (channelAggResponse || [])
                .map(item => item.channel_name)
                .filter(id => id != null);

            // Step 3: 채널명 조회 및 매핑
            let channelNameMap = {};
            if (channelIds.length > 0) {
                const channelNames = await client.request(
                    readItems('chnnl_mstr', {
                        fields: ['id', 'channel_name'],
                        filter: {
                            id: { _in: channelIds }
                        },
                        limit: -1
                    })
                );
                channelNameMap = Object.fromEntries(
                    (channelNames || []).map(ch => [ch.id, ch.channel_name])
                );
            }

            // Step 4: ID를 이름으로 변환
            const channelData = (channelAggResponse || [])
                .map(item => ({
                    name: channelNameMap[item.channel_name] || '미지정',
                    value: Number(item.count || 0)
                }))
                .sort((a, b) => b.value - a.value);

            setChannelStats(channelData);

            // Fetch channel table data (with amounts)
            const channelTableResponse = await client.request(
                readItems('ord_mstr', {
                    fields: [
                        'channel_name.channel_name',
                        'order_price',
                        'rel_settlement_amount',
                        'rel_commission_amount'
                    ],
                    filter: {
                        _and: [
                            { del_yn: { _neq: 'Y' } },
                            { order_date: { _gte: dateRange.startDate } },
                            { order_date: { _lt: nextDay } }
                        ]
                    },
                    limit: -1
                })
            );

            // Client-side aggregation by channel
            const channelTableMap = {};
            (channelTableResponse || []).forEach(order => {
                const channel = order.channel_name?.channel_name || '미지정';
                if (!channelTableMap[channel]) {
                    channelTableMap[channel] = {
                        channel,
                        count: 0,
                        amount: 0,
                        settlementAmount: 0,
                        commissionAmount: 0
                    };
                }
                channelTableMap[channel].count += 1;
                channelTableMap[channel].amount += Number(order.order_price || 0);
                channelTableMap[channel].settlementAmount += Number(order.rel_settlement_amount || 0);
                channelTableMap[channel].commissionAmount += Number(order.rel_commission_amount || 0);
            });

            const channelTableData = Object.values(channelTableMap)
                .sort((a, b) => b.amount - a.amount);

            setChannelPartnerStats(channelTableData);

        } catch (error) {
            console.error("채널별 통계 로드 실패:", error);
        }
    };

    // 채널별 탭 활성화 시에만 조회
    useEffect(() => {
        if (activeTab === 'channel') {
            fetchChannelStats();
        }
    }, [activeTab, dateRange]);

    // 4. Period Stats (Daily/Monthly) - Chart & Table
    const [periodType, setPeriodType] = useState('daily'); // 'daily' | 'monthly'
    const [periodStats, setPeriodStats] = useState([]);

    const fetchPeriodStats = async () => {
        try {
            const endDateObj = new Date(dateRange.endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const nextDay = endDateObj.toISOString().split('T')[0];

            const response = await client.request(
                aggregate('ord_mstr', {
                    aggregate: {
                        count: '*',
                        sum: [
                            'order_price',
                            'rel_settlement_amount',
                            'rel_commission_amount'
                        ]
                    },
                    groupBy: ['order_date'],
                    query: {   // 🔥 여기 중요
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: dateRange.startDate } },
                                { order_date: { _lt: nextDay } }
                            ]
                        }
                    }
                })
            );

            const dailyStatsMap = {};

            (response || []).forEach(item => {
                if (!item.order_date) return;

                const dateKey = item.order_date.split('T')[0]; // YYYY-MM-DD

                if (!dailyStatsMap[dateKey]) {
                    dailyStatsMap[dateKey] = {
                        date: dateKey,
                        count: 0,
                        amount: 0,
                        settlementAmount: 0,
                        commissionAmount: 0
                    };
                }

                dailyStatsMap[dateKey].count += Number(item.count || 0);
                dailyStatsMap[dateKey].amount += Number(item.sum?.order_price || 0);
                dailyStatsMap[dateKey].settlementAmount += Number(item.sum?.rel_settlement_amount || 0);
                dailyStatsMap[dateKey].commissionAmount += Number(item.sum?.rel_commission_amount || 0);
            });

            let stats = Object.values(dailyStatsMap);

            // 월별 집계 처리
            if (periodType === 'monthly') {
                const monthlyStatsMap = {};
                stats.forEach(stat => {
                    const monthKey = stat.date.substring(0, 7); // YYYY-MM
                    if (!monthlyStatsMap[monthKey]) {
                        monthlyStatsMap[monthKey] = {
                            date: monthKey,
                            count: 0,
                            amount: 0,
                            settlementAmount: 0,
                            commissionAmount: 0
                        };
                    }
                    monthlyStatsMap[monthKey].count += stat.count;
                    monthlyStatsMap[monthKey].amount += stat.amount;
                    monthlyStatsMap[monthKey].settlementAmount += stat.settlementAmount;
                    monthlyStatsMap[monthKey].commissionAmount += stat.commissionAmount;
                });
                stats = Object.values(monthlyStatsMap);
            }

            stats.sort((a, b) => a.date.localeCompare(b.date)); // 그래프용 오름차순 (오래된 날짜부터)

            setPeriodStats(stats);

        } catch (error) {
            console.error("기간별 통계 로드 실패:", error);
        }
    };


    // 기간별 탭 활성화 시에만 조회
    useEffect(() => {
        if (activeTab === 'date') {
            fetchPeriodStats();
        }
    }, [activeTab, dateRange, periodType]);


    return (
        <div className="space-y-4 p-4 bg-gray-50 min-h-full">
            {/* Filter Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 mr-2">
                        <span className="text-sm font-semibold text-gray-600">조회 기간 :</span>
                        <input
                            type="date"
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded outline-none focus:border-blue-500"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        />
                        <span className="text-gray-400">~</span>
                        <input
                            type="date"
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded outline-none focus:border-blue-500"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm font-semibold text-gray-600 hidden sm:inline">검색 :</span>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="지역, 파트너, 채널 검색..."
                                className={`pl-9 pr-4 py-2 w-full text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeTab === 'channel' || activeTab === 'date' ? 'bg-gray-100 cursor-not-allowed' : ''
                                    }`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && activeTab === 'partner') {
                                        fetchData();
                                    }
                                }}
                                disabled={activeTab === 'channel' || activeTab === 'date'}
                            />
                        </div>
                    </div>

                    <Button size="sm" onClick={fetchData} className="ml-2 bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                        <RefreshCw className="w-4 h-4 mr-1" /> 조회
                    </Button>
                </div>
                <div className="text-sm text-gray-500 whitespace-nowrap">
                    총 <strong className="text-blue-600">{
                        activeTab === 'partner' ? filteredPartnerStats.length :
                            activeTab === 'region' ? filteredRegionPartnerStats.length :
                                activeTab === 'channel' ? channelStats.length :
                                    activeTab === 'date' ? periodStats.length :
                                        0
                    }</strong> 건
                </div>
            </div>


            {/* Dashboard Content */}
            <Tabs defaultValue="partner" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-white p-1 border border-gray-200 rounded-lg">
                    <TabsTrigger value="partner">파트너별</TabsTrigger>
                    <TabsTrigger value="region">지역별</TabsTrigger>
                    <TabsTrigger value="channel">채널별</TabsTrigger>
                    <TabsTrigger value="date">기간별</TabsTrigger>
                </TabsList>

                {/* Partner Tab */}
                <TabsContent value="partner" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>파트너별 작업 건수</CardTitle>
                                <CardDescription>상위 파트너 현황</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={partnerStats.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#8884d8" name="건수" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>파트너별 판매 금액</CardTitle>
                                <CardDescription>상위 파트너 현황 (단위: 원)</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={filteredPartnerStats.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value) => value.toLocaleString()} />
                                        <Bar dataKey="amount" fill="#82ca9d" name="금액" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed List View (Table) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>상세 파트너별 통계 목록</CardTitle>
                            <CardDescription>검색 조건에 따른 파트너별 집계 현황</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PaginationTable
                                data={filteredPartnerStats}
                                columns={[
                                    { header: '순위', accessor: 'rank', className: 'text-center', cellClassName: 'text-center', width: 'w-[60px]', render: (_, idx) => <span className="text-gray-500">{idx + 1}</span> },
                                    { header: '파트너명 (팀장)', accessor: 'name', className: 'text-left', cellClassName: 'text-left', width: 'w-[20%]', render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
                                    { header: '활동 지역', accessor: 'regionDisplay', className: 'text-left', cellClassName: 'text-left', width: 'w-[25%]', render: (row) => <span className="text-gray-500 text-xs truncate block" title={row.regionDisplay}>{row.regionDisplay || '-'}</span> },
                                    { header: '작업 건수', accessor: 'count', className: 'text-right', cellClassName: 'text-right', width: 'w-[10%]', render: (row) => <span className="text-gray-700">{row.count}건</span> },
                                    { header: '판매금액', accessor: 'amount', className: 'text-right', cellClassName: 'text-right font-medium text-blue-600', width: 'w-[13%]', render: (row) => <span className="text-blue-600">{row.amount.toLocaleString()}</span> },
                                    { header: '정산금액', accessor: 'settlementAmount', className: 'text-right', cellClassName: 'text-right font-medium text-red-600', width: 'w-[13%]', render: (row) => <span className="text-red-600">{row.settlementAmount?.toLocaleString()}</span> },
                                    { header: '수수료금액', accessor: 'commissionAmount', className: 'text-right', cellClassName: 'text-right font-medium', width: 'w-[13%]', render: (row) => <span className="text-gray-900">{row.commissionAmount?.toLocaleString()}</span> },
                                ]}
                                footer={
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-center">합계</td>
                                        <td className="px-4 py-3 text-right">{filteredPartnerStats.reduce((sum, item) => sum + item.count, 0)}건</td>
                                        <td className="px-4 py-3 text-right text-blue-600">{filteredPartnerStats.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-red-600">{filteredPartnerStats.reduce((sum, item) => sum + (item.settlementAmount || 0), 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{filteredPartnerStats.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}</td>
                                    </tr>
                                }
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Region Tab */}
                <TabsContent value="region">
                    <Card>
                        <CardHeader>
                            <CardTitle>지역별 주문 현황</CardTitle>
                            <CardDescription>주소 분석 기반 (상위 20개 지역)</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={filteredRegionStats.slice(0, 20)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={60} />
                                    <YAxis
                                        allowDecimals={false}
                                        domain={[0, 'auto']}
                                    />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#ffc658" name="주문 건수" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                        <CardContent>
                            <PaginationTable
                                data={filteredRegionPartnerStats}
                                columns={[
                                    { header: '순위', accessor: 'rank', className: 'text-center', cellClassName: 'text-center', width: 'w-[80px]', render: (_, idx) => <span className="text-gray-500">{idx + 1}</span> },
                                    { header: '지역명', accessor: 'region', className: 'text-left', cellClassName: 'text-left', width: 'w-[20%]', render: (row) => <span className="font-medium text-gray-900">{row.region}</span> },
                                    { header: '파트너 (팀장)', accessor: 'partner', className: 'text-left', cellClassName: 'text-left', width: 'w-[30%]', render: (row) => <span className="text-gray-500">{row.partnerName} <span className='text-xs text-gray-400'>({row.teamLeader})</span></span> },
                                    { header: '작업 건수', accessor: 'count', className: 'text-right', cellClassName: 'text-right', width: 'w-[10%]', render: (row) => <span className="text-gray-700">{row.count}건</span> },
                                    { header: '판매금액', accessor: 'amount', className: 'text-right', cellClassName: 'text-right font-medium text-blue-600', width: 'w-[13%]', render: (row) => <span className="text-blue-600">{row.amount.toLocaleString()}</span> },
                                    { header: '정산금액', accessor: 'settlementAmount', className: 'text-right', cellClassName: 'text-right font-medium text-red-600', width: 'w-[13%]', render: (row) => <span className="text-red-600">{row.settlementAmount?.toLocaleString()}</span> },
                                    { header: '수수료금액', accessor: 'commissionAmount', className: 'text-right', cellClassName: 'text-right font-medium', width: 'w-[13%]', render: (row) => <span className="text-gray-900">{row.commissionAmount?.toLocaleString()}</span> },
                                ]}
                                footer={
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-center">합계</td>
                                        <td className="px-4 py-3 text-right">{filteredRegionPartnerStats.reduce((sum, item) => sum + item.count, 0)}건</td>
                                        <td className="px-4 py-3 text-right text-blue-600">{filteredRegionPartnerStats.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-red-600">{filteredRegionPartnerStats.reduce((sum, item) => sum + (item.settlementAmount || 0), 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{filteredRegionPartnerStats.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}</td>
                                    </tr>
                                }
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Channel Tab */}
                <TabsContent value="channel">
                    <Card>
                        <CardHeader>
                            <CardTitle>채널별 주문 비중</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[400px] flex justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={channelStats}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        outerRadius={150}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {channelStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                        <CardContent>
                            <PaginationTable
                                data={channelPartnerStats}
                                columns={[
                                    { header: '순위', accessor: 'rank', className: 'text-center', cellClassName: 'text-center', width: 'w-[80px]', render: (_, idx) => <span className="text-gray-500">{idx + 1}</span> },
                                    { header: '채널', accessor: 'channel', className: 'text-left', cellClassName: 'text-left', width: 'w-[30%]', render: (row) => <span className="font-medium text-gray-900">{row.channel}</span> },
                                    { header: '작업 건수', accessor: 'count', className: 'text-right', cellClassName: 'text-right', width: 'w-[15%]', render: (row) => <span className="text-gray-700">{row.count}건</span> },
                                    { header: '판매금액', accessor: 'amount', className: 'text-right', cellClassName: 'text-right font-medium text-blue-600', width: 'w-[18%]', render: (row) => <span className="text-blue-600">{row.amount.toLocaleString()}</span> },
                                    { header: '정산금액', accessor: 'settlementAmount', className: 'text-right', cellClassName: 'text-right font-medium text-red-600', width: 'w-[18%]', render: (row) => <span className="text-red-600">{row.settlementAmount?.toLocaleString()}</span> },
                                    { header: '수수료금액', accessor: 'commissionAmount', className: 'text-right', cellClassName: 'text-right font-medium', width: 'w-[18%]', render: (row) => <span className="text-gray-900">{row.commissionAmount?.toLocaleString()}</span> },
                                ]}
                                footer={
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-center">합계</td>
                                        <td className="px-4 py-3 text-right">{channelPartnerStats.reduce((sum, item) => sum + item.count, 0)}건</td>
                                        <td className="px-4 py-3 text-right text-blue-600">{channelPartnerStats.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-red-600">{channelPartnerStats.reduce((sum, item) => sum + (item.settlementAmount || 0), 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{channelPartnerStats.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}</td>
                                    </tr>
                                }
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Period Tab */}
                <TabsContent value="date">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>기간별 주문 추이</CardTitle>
                            <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                <button
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${periodType === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setPeriodType('daily')}
                                >
                                    일별
                                </button>
                                <button
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${periodType === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setPeriodType('monthly')}
                                >
                                    월별
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={periodStats}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis yAxisId="left" />
                                    <YAxis yAxisId="right" orientation="right" />
                                    <Tooltip />
                                    <Legend />
                                    <Line yAxisId="left" type="monotone" dataKey="count" stroke="#8884d8" name="주문 건수" />
                                    <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#82ca9d" name="주문 금액" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                        <CardContent>
                            <PaginationTable
                                data={[...periodStats].sort((a, b) => b.date.localeCompare(a.date))}
                                columns={[
                                    { header: '날짜', accessor: 'date', className: 'text-left', cellClassName: 'text-left', width: 'w-[40%]', render: (row) => <span className="font-medium text-gray-900">{row.date}</span> },
                                    { header: '작업 건수', accessor: 'count', className: 'text-right', cellClassName: 'text-right', width: 'w-[15%]', render: (row) => <span className="text-gray-700">{row.count}건</span> },
                                    { header: '판매금액', accessor: 'amount', className: 'text-right', cellClassName: 'text-right font-medium text-blue-600', width: 'w-[15%]', render: (row) => <span className="text-blue-600">{row.amount.toLocaleString()}</span> },
                                    { header: '정산금액', accessor: 'settlementAmount', className: 'text-right', cellClassName: 'text-right font-medium text-red-600', width: 'w-[15%]', render: (row) => <span className="text-red-600">{row.settlementAmount?.toLocaleString()}</span> },
                                    { header: '수수료금액', accessor: 'commissionAmount', className: 'text-right', cellClassName: 'text-right font-medium', width: 'w-[15%]', render: (row) => <span className="text-gray-900">{row.commissionAmount?.toLocaleString()}</span> },
                                ]}
                                footer={
                                    <tr>
                                        <td className="px-4 py-3 text-center">합계</td>
                                        <td className="px-4 py-3 text-right">{periodStats.reduce((sum, item) => sum + item.count, 0)}건</td>
                                        <td className="px-4 py-3 text-right text-blue-600">{periodStats.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-red-600">{periodStats.reduce((sum, item) => sum + (item.settlementAmount || 0), 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{periodStats.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}</td>
                                    </tr>
                                }
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
