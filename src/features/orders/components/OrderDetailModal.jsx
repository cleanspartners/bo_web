import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { updateItem, createItem, readItem, readItems, readUsers } from '@directus/sdk';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ORDER_STATUSES = [
    '접수', '작업보류', '예약진행', '처리완료', '접수취소'
];

export default function OrderDetailModal({ isOpen, onClose, orderId, onUpdate }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({});
    const [initialOrder, setInitialOrder] = useState({});
    const [channels, setChannels] = useState([]);
    const [partners, setPartners] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchChannels();
            fetchPartners();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            if (orderId) {
                fetchOrder();
            } else {
                // 신규 등록 모드 초기화
                setOrder(null);
                const initialData = {
                    status: '접수',
                    order_date: new Date().toISOString().slice(0, 16), // 현재 시간
                    customer_name: '',
                    phone: '',
                    address: '',
                    service_type: '',
                    partner: '',
                    channel_name: '',
                    commission_type: '비율',
                    order_price: 0,
                    commission: 0,
                    rel_settlement_amount: 0,
                    rel_commission_amount: 0,
                    cstm_memo: '',
                    memo: '',
                };
                setFormData(initialData);
                setInitialOrder({}); // 신규는 변경 비교용 데이터 없음
            }
        }
    }, [isOpen, orderId]);

    const fetchPartners = async () => {
        try {
            const response = await client.request(readUsers({
                limit: -1,
                fields: ['id', 'first_name', 'last_name', 'email'],
                sort: ['first_name']
            }));
            setPartners(response);
        } catch (error) {
            console.error("파트너 목록 조회 실패:", error);
        }
    };

    const fetchChannels = async () => {
        try {
            const response = await client.request(readItems('chnnl_mstr', {
                limit: 100,
                fields: ['id', 'channel_name'],
                sort: ['channel_name']
            }));
            setChannels(response);
        } catch (error) {
            console.error("채널 목록 조회 실패:", error);
        }
    };

    const formatUserName = (user) => {
        if (!user || typeof user !== 'object') return '-';
        return `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-';
    };

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const response = await client.request(readItem('ord_mstr', orderId, {
                fields: [
                    '*',
                    'partner.*',
                    'user_created.*',
                    'user_updated.*',
                    'channel_name.*'
                ]
            }));
            setOrder(response);

            const initialData = {
                status: response.status || '',
                order_date: response.order_date ? response.order_date.slice(0, 16) : '',
                customer_name: response.customer_name || '',
                phone: response.phone || '',
                address: response.address || '',
                service_type: response.service_type || '',
                partner: response.partner?.id || '',
                channel_name: response.channel_name?.id || '',
                commission_type: response.commission_type || '비율',
                order_price: response.order_price || 0,
                commission: response.commission || 0,
                rel_settlement_amount: response.rel_settlement_amount || 0,
                rel_commission_amount: response.rel_commission_amount || 0,
                cstm_memo: response.cstm_memo || '',
                memo: response.memo || '',
            };

            setFormData(initialData);
            setInitialOrder(initialData);
        } catch (error) {
            console.error("주문 상세 조회 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 숫자 포맷팅 (콤마 추가)
    const formatNumber = (num) => {
        if (!num) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        // 숫자만 입력 가능하도록 (콤마 제외)
        const rawValue = value.replace(/,/g, '');
        if (isNaN(rawValue)) return;

        setFormData(prev => ({ ...prev, [name]: Number(rawValue) }));
    };

    // 수수료 및 정산금액 자동 계산
    useEffect(() => {
        if (formData.commission_type === '수동') return;

        const orderPrice = Number(formData.order_price) || 0;
        const commissionVal = Number(formData.commission) || 0;
        let settlementAmount = 0;
        let commissionAmount = 0;

        if (formData.commission_type === '비율') {
            // 비율인 경우: commission이 퍼센트(%)
            commissionAmount = Math.floor(orderPrice * (commissionVal / 100));
            settlementAmount = orderPrice - commissionAmount;
        } else {
            // 금액인 경우: commission이 금액(원)
            commissionAmount = commissionVal;
            settlementAmount = orderPrice - commissionAmount;
        }

        setFormData(prev => {
            // 값이 변경된 경우에만 업데이트하여 불필요한 렌더링 방지
            if (prev.rel_settlement_amount === settlementAmount && prev.rel_commission_amount === commissionAmount) {
                return prev;
            }
            return {
                ...prev,
                rel_settlement_amount: settlementAmount,
                rel_commission_amount: commissionAmount
            };
        });
    }, [formData.order_price, formData.commission, formData.commission_type]);

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // 유효성 검사 (필수 필드)
            if (!formData.customer_name) {
                alert("고객명을 입력해주세요.");
                setLoading(false);
                return;
            }

            if (orderId) {
                // 수정 모드
                const payload = {};
                Object.keys(formData).forEach(key => {
                    if (formData[key] !== initialOrder[key]) {
                        payload[key] = formData[key];
                    }
                });

                if (Object.keys(payload).length === 0) {
                    alert("변경된 내용이 없습니다.");
                    setLoading(false);
                    return;
                }

                await client.request(updateItem('ord_mstr', orderId, payload));
                alert("수정되었습니다.");
            } else {
                // 신규 등록 모드
                await client.request(createItem('ord_mstr', formData));
                alert("등록되었습니다.");
            }

            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error("저장 실패:", error);
            alert("저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 bg-white rounded-xl overflow-hidden">
                <DialogHeader className="p-6 pb-2 bg-slate-50 border-b border-slate-100 shrink-0">
                    <DialogTitle className="text-xl font-semibold text-slate-800">
                        {orderId ? '주문내역 편집' : '신규 주문 등록'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        주문 상세 내역을 확인하고 수정하거나 신규 주문을 등록합니다.
                    </DialogDescription>
                </DialogHeader>

                {loading && !formData.order_date ? ( // 로딩 중이고 데이터가 아예 없을 때만 로딩 표시
                    <div className="py-10 text-center">로딩중...</div>
                ) : (
                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-6 border rounded-lg overflow-hidden bg-white text-sm">
                            {/* Row 1 */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">작업상태</div>
                            <div className="p-3 border-b border-slate-200 border-r md:border-r-0 md:border-l md:border-l-0 md:col-span-2">
                                <Select
                                    value={formData.status}
                                    onValueChange={(val) => handleSelectChange('status', val)}
                                >
                                    <SelectTrigger className="w-full h-8">
                                        <SelectValue placeholder="상태 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ORDER_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-slate-50 p-4 border-b border-slate-200 border-t md:border-t-0 border-r-0 md:border-l border-slate-200 flex items-center font-medium text-slate-700">파트너</div>
                            <div className="p-3 border-b border-slate-200 md:border-t-0 md:col-span-2">
                                <Select
                                    value={formData.partner ? String(formData.partner) : ''}
                                    onValueChange={(val) => handleSelectChange('partner', val)}
                                >
                                    <SelectTrigger className="w-full h-8">
                                        <SelectValue placeholder="파트너 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {partners.map(partner => (
                                            <SelectItem key={partner.id} value={String(partner.id)}>
                                                {formatUserName(partner)} ({partner.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Row 2 */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">요청 날짜</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Input
                                    type="datetime-local"
                                    name="order_date"
                                    value={formData.order_date}
                                    onChange={handleChange}
                                    className="h-8"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 border-b border-slate-200 border-l border-slate-200 flex items-center font-medium text-slate-700">고객명</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Input
                                    name="customer_name"
                                    value={formData.customer_name}
                                    onChange={handleChange}
                                    className="h-8"
                                />
                            </div>

                            {/* Row 3 - Full Width for Mobile, Spans 5 cols for Desktop */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">연락처</div>
                            <div className="p-3 border-b border-slate-200 border-r md:border-r-0 col-span-1 md:col-span-5">
                                <Input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="h-8 max-w-sm"
                                />
                            </div>

                            {/* Row 4 */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">주소</div>
                            <div className="p-3 border-b border-slate-200 col-span-1 md:col-span-5">
                                <Input
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="h-8"
                                />
                            </div>

                            {/* Row 5 */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">서비스 항목</div>
                            <div className="p-3 border-b border-slate-200 col-span-1 md:col-span-5">
                                <Input
                                    name="service_type"
                                    value={formData.service_type}
                                    onChange={handleChange}
                                    className="h-8"
                                />
                            </div>

                            {/* Row 6 */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">채널명</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Select
                                    value={formData.channel_name ? String(formData.channel_name) : ''}
                                    onValueChange={(val) => handleSelectChange('channel_name', val)}
                                >
                                    <SelectTrigger className="w-full h-8">
                                        <SelectValue placeholder="채널 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {channels.map(channel => (
                                            <SelectItem key={channel.id} value={String(channel.id)}>
                                                {channel.channel_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-slate-50 p-4 border-b border-slate-200 border-l border-slate-200 flex items-center font-medium text-slate-700">수수료 타입</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Select
                                    value={formData.commission_type}
                                    onValueChange={(val) => handleSelectChange('commission_type', val)}
                                >
                                    <SelectTrigger className="w-full h-8">
                                        <SelectValue placeholder="수수료 타입 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="비율">비율(%)</SelectItem>
                                        <SelectItem value="금액">금액(원)</SelectItem>
                                        <SelectItem value="수동">수동</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Row 7 - Financials */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">판매 금액 (정가)</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Input
                                    type="text"
                                    name="order_price"
                                    value={formatNumber(formData.order_price)}
                                    onChange={handleNumberChange}
                                    placeholder="0"
                                    className="h-8 text-right font-medium"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 border-b border-slate-200 border-l border-slate-200 flex items-center font-medium text-slate-700">
                                {formData.commission_type === '비율' ? '수수료 (%)' : '수수료 (원)'}
                            </div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Input
                                    type="text"
                                    name="commission"
                                    value={formatNumber(formData.commission)}
                                    onChange={handleNumberChange}
                                    placeholder="0"
                                    className="h-8 text-right font-medium"
                                />
                            </div>

                            {/* Row 8 - Results */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center font-medium text-slate-700">정산 금액 (지급액)</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Input
                                    type="text"
                                    name="rel_settlement_amount"
                                    value={formatNumber(formData.rel_settlement_amount)}
                                    readOnly={formData.commission_type !== '수동'}
                                    onChange={handleNumberChange}
                                    className={`h-8 text-right font-bold ${formData.commission_type === '수동' ? "" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                                />
                            </div>

                            <div className="bg-slate-50 p-4 border-b border-slate-200 border-l border-slate-200 flex items-center font-medium text-slate-700">수수료 금액 (수익)</div>
                            <div className="p-3 border-b border-slate-200 md:col-span-2">
                                <Input
                                    type="text"
                                    name="rel_commission_amount"
                                    value={formatNumber(formData.rel_commission_amount)}
                                    readOnly={formData.commission_type !== '수동'}
                                    onChange={handleNumberChange}
                                    className={`h-8 text-right font-bold ${formData.commission_type === '수동' ? "" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                                />
                            </div>

                            {/* Row 9 - Memos */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-start font-medium text-slate-700 pt-6">고객 메모</div>
                            <div className="p-3 border-b border-slate-200 col-span-1 md:col-span-5">
                                <Textarea
                                    name="cstm_memo"
                                    value={formData.cstm_memo || ''}
                                    onChange={handleChange}
                                    className="min-h-[80px] resize-none"
                                />
                            </div>

                            <div className="bg-slate-50 p-4 border-b md:border-b-0 flex items-start font-medium text-slate-700 pt-6">관리자 메모</div>
                            <div className="p-3 border-b md:border-b-0 col-span-1 md:col-span-5">
                                <Textarea
                                    name="memo"
                                    value={formData.memo || ''}
                                    onChange={handleChange}
                                    className="min-h-[80px] resize-none"
                                />
                            </div>
                        </div>

                        {/* Metadata Footer - Table Style */}
                        <div className="mt-6 border rounded-lg overflow-hidden bg-white text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-6">
                                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center font-medium text-slate-700">등록자</div>
                                <div className="p-3 border-b border-slate-200 border-r md:border-r-0 md:border-l md:border-l-0 text-slate-600 md:col-span-2">
                                    {formatUserName(order?.user_created)}
                                </div>
                                <div className="bg-slate-50 p-3 border-b border-slate-200 border-t md:border-t-0 border-r-0 md:border-l border-slate-200 flex items-center font-medium text-slate-700">등록 일시</div>
                                <div className="p-3 border-b border-slate-200 md:border-t-0 text-slate-600 md:col-span-2">
                                    {order?.date_created ? new Date(order.date_created).toLocaleString() : '-'}
                                </div>

                                <div className="bg-slate-50 p-3 flex items-center font-medium text-slate-700 border-b md:border-b-0">수정자</div>
                                <div className="p-3 border-b md:border-b-0 border-r md:border-r-0 md:border-l md:border-l-0 text-slate-600 md:col-span-2">
                                    {formatUserName(order?.user_updated)}
                                </div>
                                <div className="bg-slate-50 p-3 border-l border-slate-200 flex items-center font-medium text-slate-700 border-b md:border-b-0 border-t md:border-t-0">수정 일시</div>
                                <div className="p-3 md:border-t-0 text-slate-600 md:col-span-2">
                                    {order?.date_updated ? new Date(order.date_updated).toLocaleString() : '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 sm:justify-center gap-2 shrink-0">
                    <Button variant="outline" onClick={onClose} className="px-8 border-slate-300 text-slate-700 hover:bg-slate-100">취소</Button>
                    <Button onClick={handleSubmit} className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
