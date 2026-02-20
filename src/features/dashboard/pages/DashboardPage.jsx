import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { readItems, readUsers, aggregate } from '@directus/sdk';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import { Calendar, Clock, AlertCircle, CheckCircle2, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // KPI Data
    const [stats, setStats] = useState({
        todayCount: 0,
        tomorrowCount: 0,
        overdueCount: 0,
        unassignedCount: 0,
        asCount: 0
    });

    // Charts Data
    const [weeklySchedule, setWeeklySchedule] = useState([]);

    // List Data
    const [upcomingSchedules, setUpcomingSchedules] = useState([]);
    const [todayPartnerRank, setTodayPartnerRank] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        // console.log('Fetching dashboard data...'); // 디버깅용 로그
        setLoading(true);

        // 날짜 계산 유틸리티 (Local Time 기준)
        const getToday = () => {
            const date = new Date();
            const offset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - offset);
            return localDate.toISOString().split('T')[0];
        };

        const getTomorrow = () => {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            const offset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - offset);
            return localDate.toISOString().split('T')[0];
        };

        const today = getToday();
        const tomorrow = getTomorrow();

        // Calculate dates for ranges
        const todayStart = today;
        const tomorrowStart = tomorrow;

        const dayAfterTomorrow = new Date();
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        const dayAfterTomorrowStart = dayAfterTomorrow.toISOString().split('T')[0];

        try {
            // 1. KPI Counts
            const [todayRes, tomorrowRes, overdueRes, unassignedRes, asRes] = await Promise.all([
                // Today's Jobs
                client.request(aggregate('ord_mstr', {
                    aggregate: { count: '*' },
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: todayStart } },
                                { order_date: { _lt: tomorrowStart } }
                            ]
                        }
                    }
                })),
                // Tomorrow's Jobs
                client.request(aggregate('ord_mstr', {
                    aggregate: { count: '*' },
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _gte: tomorrowStart } },
                                { order_date: { _lt: dayAfterTomorrowStart } }
                            ]
                        }
                    }
                })),
                // Overdue Jobs (Date < Today AND Status != 'Payment Completed')
                client.request(aggregate('ord_mstr', {
                    aggregate: { count: '*' },
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { order_date: { _lt: todayStart } },
                                { status: { _nin: ['입금완료'] } }
                            ]
                        }
                    }
                })),
                // Unassigned (Specific Partner ID)
                client.request(aggregate('ord_mstr', {
                    aggregate: { count: '*' },
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { partner: { _eq: 'd6e6568c-48f0-4951-89e5-1c88421de160' } }
                            ]
                        }
                    }
                })),
                // AS Receipt
                client.request(aggregate('ord_mstr', {
                    aggregate: { count: '*' },
                    query: {
                        filter: {
                            _and: [
                                { del_yn: { _neq: 'Y' } },
                                { status: { _eq: 'AS접수' } }
                            ]
                        }
                    }
                }))
            ]);

            setStats({
                todayCount: Number(todayRes?.[0]?.count || 0),
                tomorrowCount: Number(tomorrowRes?.[0]?.count || 0),
                overdueCount: Number(overdueRes?.[0]?.count || 0),
                unassignedCount: Number(unassignedRes?.[0]?.count || 0),
                asCount: Number(asRes?.[0]?.count || 0)
            });

            // 2. Weekly Schedule Chart (Next 7 days)
            const next7DaysEnd = new Date();
            next7DaysEnd.setDate(next7DaysEnd.getDate() + 7);
            const next7DaysEndStr = next7DaysEnd.toISOString().split('T')[0];

            const weeklyRes = await client.request(aggregate('ord_mstr', {
                aggregate: { count: '*' },
                groupBy: ['order_date'],
                query: {
                    filter: {
                        _and: [
                            { del_yn: { _neq: 'Y' } },
                            { order_date: { _gte: today } },
                            { order_date: { _lt: next7DaysEndStr } }
                        ]
                    }
                }
            }));

            // Process existing data
            const weeklyMap = {};
            weeklyRes?.forEach(item => {
                if (item.order_date) {
                    const date = item.order_date.split('T')[0];
                    weeklyMap[date] = (weeklyMap[date] || 0) + Number(item.count || 0);
                }
            });

            // Fill 7 days
            const weeklyData = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('ko-KR', { weekday: 'short' });
                weeklyData.push({
                    date: `${dateStr.substring(5)} (${dayName})`,
                    fullDate: dateStr,
                    count: weeklyMap[dateStr] || 0
                });
            }
            setWeeklySchedule(weeklyData);

            // 3. Upcoming Schedule List
            const upcomingRes = await client.request(readItems('ord_mstr', {
                fields: [
                    'id', 'customer_name', 'order_date', 'address', 'service_type', 'status',
                    'partner.first_name', 'partner.last_name'
                ],
                filter: {
                    _and: [
                        { del_yn: { _neq: 'Y' } },
                        { order_date: { _gte: today } }
                    ]
                },
                sort: ['order_date'],
                limit: 6
            }));
            setUpcomingSchedules(upcomingRes || []);


            // 4. Top Partners Today
            const partnersAggRes = await client.request(aggregate('ord_mstr', {
                aggregate: { count: '*' },
                groupBy: ['partner'],
                query: {
                    filter: {
                        _and: [
                            { del_yn: { _neq: 'Y' } },
                            { order_date: { _gte: todayStart } },
                            { order_date: { _lt: tomorrowStart } }
                        ]
                    }
                }
            }));

            const partnerIds = partnersAggRes?.map(i => i.partner).filter(Boolean) || [];
            let partnerNameMap = {};
            if (partnerIds.length > 0) {
                const partnersResponse = await client.request(readUsers({
                    fields: ['id', 'first_name', 'last_name'],
                    filter: { id: { _in: partnerIds } }
                }));
                partnerNameMap = Object.fromEntries(partnersResponse.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
            }

            const partnerData = partnersAggRes?.map(item => ({
                name: partnerNameMap[item.partner] || '미배정',
                value: Number(item.count || 0),
                id: item.partner
            })).filter(p => p.name !== '미배정') // Filter out unassigned if any
                .sort((a, b) => b.value - a.value)
                .slice(0, 5); // Top 5

            setTodayPartnerRank(partnerData);


        } catch (error) {
            console.error("Dashboard data fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const getDDay = (dateStr) => {
        if (!dateStr) return '';
        const target = new Date(dateStr.split('T')[0]);
        const today = new Date(new Date().toISOString().split('T')[0]);
        const diffTime = target - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'D-Day';
        if (diffDays < 0) return `D+${Math.abs(diffDays)}`; // Should be handled by section, but just in case
        return `D-${diffDays}`;
    };

    const getDDayBadgeColor = (dDay) => {
        if (dDay === 'D-Day') return 'bg-red-100 text-red-800 border-red-200';
        if (dDay.startsWith('D-')) {
            const days = parseInt(dDay.split('-')[1]);
            if (days <= 1) return 'bg-orange-100 text-orange-800 border-orange-200';
            if (days <= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
        return 'bg-blue-100 text-blue-800 border-blue-200';
    };

    return (
        <div className="space-y-4 p-2 md:p-4 bg-gray-50 min-h-full">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/orders?date=today')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">오늘의 작업</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.todayCount}건</div>
                        <p className="text-xs text-gray-500 mt-1">오늘 방문 예정</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/orders?partnerId=d6e6568c-48f0-4951-89e5-1c88421de160')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">미배정</CardTitle>
                        <UserX className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.unassignedCount}건</div>
                        <p className="text-xs text-gray-500 mt-1">담당자 미배정</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-red-200 bg-red-50/50" onClick={() => navigate('/orders?status=late')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">작업 지연</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.overdueCount}건</div>
                        <p className="text-xs text-red-600/80 mt-1">작업 완료이나 입금 미 완료건</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-pink-200 bg-pink-50/50" onClick={() => navigate('/orders?status=AS접수')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-pink-600">AS 접수</CardTitle>
                        <AlertCircle className="h-4 w-4 text-pink-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-pink-600">{stats.asCount}건</div>
                        <p className="text-xs text-pink-600/80 mt-1">신속한 처리 필요</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/orders?date=tomorrow')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">내일 예정</CardTitle>
                        <Clock className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{stats.tomorrowCount}건</div>
                        <p className="text-xs text-gray-500 mt-1">미리 준비하세요</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mt-6">
                {/* Weekly Schedule Chart */}
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>주간 작업 일정</CardTitle>
                        <CardDescription>향후 7일간의 방문 예약 현황입니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-0">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklySchedule} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{ fill: '#f3f4f6' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming List */}
                <Card className="lg:col-span-3 flex flex-col">
                    <CardHeader>
                        <CardTitle>다가오는 일정</CardTitle>
                        <CardDescription>가장 빠른 방문 예약 6건</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto">
                        <div className="space-y-4">
                            {upcomingSchedules.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">예정된 일정이 없습니다.</p>
                            ) : (
                                upcomingSchedules.map(order => {
                                    const dDay = getDDay(order.order_date);
                                    return (
                                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigate('/orders')}>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className={`${getDDayBadgeColor(dDay)} whitespace-nowrap`}>
                                                    {dDay}
                                                </Badge>
                                                <div>
                                                    <div className="font-medium text-sm text-gray-900">{order.customer_name} 고객님</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                                        <span>{order.service_type}</span>
                                                        <span className="text-gray-300">|</span>
                                                        <span>{order.partner ? `${order.partner.first_name} 팀장` : '파트너 미정'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-gray-600 block sm:hidden">
                                                    {order.order_date?.split('T')[0].substring(5)}
                                                </div>
                                                <div className="text-xs text-gray-600 hidden sm:block">
                                                    {order.order_date?.split('T')[0]}
                                                </div>
                                                <div className={`text-[10px] ${order.status === '접수' ? 'text-blue-600' : 'text-gray-500'}`}>
                                                    {order.status}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Partners Today */}
            <div className="grid grid-cols-1 gap-4 mt-2">
                <Card>
                    <CardHeader>
                        <CardTitle>오늘의 바쁜 팀장님 TOP 5</CardTitle>
                        <CardDescription>오늘 방문 일정이 가장 많은 파트너입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {todayPartnerRank.length === 0 ? (
                                <div className="col-span-full text-center text-gray-500 py-8">
                                    오늘 예정된 작업이 없습니다.
                                </div>
                            ) : (
                                todayPartnerRank.map((partner, index) => (
                                    <div key={index} className="flex items-center p-4 bg-white border rounded-lg shadow-sm">
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold mr-3 ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            index === 1 ? 'bg-gray-100 text-gray-700' :
                                                index === 2 ? 'bg-orange-50 text-orange-700' :
                                                    'bg-slate-50 text-slate-600'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{partner.name}</div>
                                            <div className="text-sm text-gray-500">{partner.value}건 예정</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
