import { useState, useEffect } from 'react';
import client from '@/lib/directus';
import { updateItem, createItem, readItem, readItems, readField } from '@directus/sdk';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PartnerCombobox from './PartnerCombobox';
import { useOrderStatuses } from '../hooks/useOrderStatuses';

export default function OrderDetailModal({ isOpen, onClose, orderId, onUpdate }) {
    const { statuses: ORDER_STATUSES } = useOrderStatuses();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({});
    const [initialOrder, setInitialOrder] = useState({});
    const [channels, setChannels] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchChannels();
            fetchPaymentMethodField();
            if (orderId) {
                fetchOrder();
            } else {
                setOrder(null);
                const initialData = {
                    status: '접수',
                    order_date: new Date().toISOString().slice(0, 16),
                    customer_name: '',
                    phone: '',
                    address: '',
                    service_category: '',
                    service_type: '',
                    partner: '',
                    channel_name: '',
                    payment_method: '',
                    commission_type: '비율',
                    order_price: 0,
                    commission: 0,
                    vat: 0,
                    rel_settlement_amount: 0,
                    rel_commission_amount: 0,
                    cstm_memo: '',
                    memo: '',
                };
                setFormData(initialData);
                setInitialOrder({});
            }
        }
    }, [isOpen, orderId]);

    const fetchChannels = async () => {
        try {
            const response = await client.request(readItems('chnnl_mstr', {
                limit: 100, fields: ['id', 'channel_name'], sort: ['channel_name']
            }));
            setChannels(response);
        } catch (error) { console.error("채널 목록 조회 실패:", error); }
    };

    const fetchPaymentMethodField = async () => {
        try {
            const response = await client.request(readField('ord_mstr', 'payment_method'));
            setPaymentMethods(response.meta?.options?.choices || []);
        } catch (error) { console.error("결제 수단 필드 정보 로드 실패:", error); }
    };

    const formatUserName = (user) => {
        if (!user || typeof user !== 'object') return '-';
        return `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-';
    };

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const response = await client.request(readItem('ord_mstr', orderId, {
                fields: ['*', 'partner.*', 'user_created.*', 'user_updated.*', 'channel_name.*']
            }));
            setOrder(response);
            const initialData = {
                status: response.status || '',
                order_date: response.order_date ? response.order_date.slice(0, 16) : '',
                customer_name: response.customer_name || '',
                phone: response.phone || '',
                address: response.address || '',
                service_category: response.service_category || '',
                service_type: response.service_type || '',
                partner: response.partner?.id || '',
                channel_name: response.channel_name?.id || '',
                payment_method: response.payment_method || '',
                commission_type: response.commission_type || '비율',
                order_price: response.order_price || 0,
                commission: response.commission || 0,
                vat: response.vat || 0,
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
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'payment_method') {
                const purePrice = Number(prev.order_price || 0) - Number(prev.vat || 0);
                let newVat = 0;
                if (value === 'BILLING_DOC') newVat = Math.floor(purePrice * 0.1);
                newData.vat = newVat;
                newData.order_price = purePrice + newVat;
            }
            return newData;
        });
    };

    const formatNumber = (num) => {
        if (!num) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        const rawValue = value.replace(/,/g, '');
        if (isNaN(rawValue)) return;
        setFormData(prev => ({ ...prev, [name]: Number(rawValue) }));
    };

    useEffect(() => {
        if (formData.commission_type === '수동') return;
        const purePrice = (Number(formData.order_price) || 0) - (Number(formData.vat) || 0);
        const commissionVal = Number(formData.commission) || 0;
        let settlementAmount = 0;
        let commissionAmount = 0;
        if (formData.commission_type === '비율') {
            commissionAmount = Math.floor(purePrice * (commissionVal / 100));
            settlementAmount = purePrice - commissionAmount;
        } else {
            commissionAmount = commissionVal;
            settlementAmount = purePrice - commissionAmount;
        }
        setFormData(prev => {
            if (prev.rel_settlement_amount === settlementAmount && prev.rel_commission_amount === commissionAmount) return prev;
            return { ...prev, rel_settlement_amount: settlementAmount, rel_commission_amount: commissionAmount };
        });
    }, [formData.order_price, formData.commission, formData.commission_type]);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            if (!formData.customer_name) { alert("고객명을 입력해주세요."); setLoading(false); return; }
            if (orderId) {
                const payload = {};
                Object.keys(formData).forEach(key => {
                    if (formData[key] !== initialOrder[key]) payload[key] = formData[key];
                });
                if (Object.keys(payload).length === 0) { alert("변경된 내용이 없습니다."); setLoading(false); return; }
                await client.request(updateItem('ord_mstr', orderId, payload));
                alert("수정되었습니다.");
            } else {
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

    // ✅ 반응형 행 컴포넌트
    // 모바일: 라벨 위, 값 아래 (1열)
    // 데스크탑: 라벨 왼쪽, 값 오른쪽 (2열)
    const FormRow = ({ label, children, fullWidth = false }) => (
        <div className={`border-b border-slate-200 ${fullWidth ? '' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center">
                <div className="bg-slate-50 px-4 py-2.5 sm:py-3 sm:w-36 sm:min-w-[9rem] shrink-0 font-medium text-slate-600 text-sm border-b border-slate-100 sm:border-b-0 sm:border-r sm:border-slate-200">
                    {label}
                </div>
                <div className="px-4 py-2.5 sm:py-3 flex-1 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );

    // ✅ 모바일: 1열 쌓기 / 데스크탑: 2열 나란히
    const FormRowPair = ({ label1, children1, label2, children2 }) => (
        <div className="border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:divide-x sm:divide-slate-200">
                {/* 왼쪽 */}
                <div className="flex flex-col sm:flex-row sm:items-center flex-1 border-b border-slate-100 sm:border-b-0">
                    <div className="bg-slate-50 px-4 py-2.5 sm:py-3 sm:w-36 sm:min-w-[9rem] shrink-0 font-medium text-slate-600 text-sm border-b border-slate-100 sm:border-b-0 sm:border-r sm:border-slate-200">
                        {label1}
                    </div>
                    <div className="px-4 py-2.5 sm:py-3 flex-1 min-w-0">
                        {children1}
                    </div>
                </div>
                {/* 오른쪽 */}
                <div className="flex flex-col sm:flex-row sm:items-center flex-1">
                    <div className="bg-slate-50 px-4 py-2.5 sm:py-3 sm:w-36 sm:min-w-[9rem] shrink-0 font-medium text-slate-600 text-sm border-b border-slate-100 sm:border-b-0 sm:border-r sm:border-slate-200">
                        {label2}
                    </div>
                    <div className="px-4 py-2.5 sm:py-3 flex-1 min-w-0">
                        {children2}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-white rounded-xl overflow-hidden">
                <DialogHeader className="px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
                    <DialogTitle className="text-xl font-semibold text-slate-800">
                        {orderId ? '주문내역 편집' : '신규 주문 등록'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">주문 상세 내역</DialogDescription>
                </DialogHeader>

                {loading && !formData.order_date ? (
                    <div className="py-10 text-center text-slate-400">로딩중...</div>
                ) : (
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                        <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">

                            {/* 작업상태 / 파트너 */}
                            <FormRowPair
                                label1="작업상태"
                                children1={
                                    <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="상태 선택" /></SelectTrigger>
                                        <SelectContent>
                                            {ORDER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.text}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                }
                                label2="파트너"
                                children2={
                                    <PartnerCombobox value={formData.partner} onChange={(val) => handleSelectChange('partner', val)} />
                                }
                            />

                            {/* 요청날짜 / 고객명 */}
                            <FormRowPair
                                label1="요청 날짜"
                                children1={
                                    <Input type="datetime-local" name="order_date" value={formData.order_date} onChange={handleChange} className="h-9 w-full text-sm" />
                                }
                                label2="고객명"
                                children2={
                                    <Input name="customer_name" value={formData.customer_name} onChange={handleChange} className="h-9 w-full text-sm" />
                                }
                            />

                            {/* 연락처 */}
                            <FormRow label="연락처">
                                <Input name="phone" value={formData.phone} onChange={handleChange} className="h-9 w-full max-w-sm text-sm" />
                            </FormRow>

                            {/* 주소 */}
                            <FormRow label="주소">
                                <Input name="address" value={formData.address} onChange={handleChange} className="h-9 w-full text-sm" />
                            </FormRow>

                            {/* 서비스구분 / 서비스항목 */}
                            <FormRowPair
                                label1="서비스구분"
                                children1={
                                    <Select
                                        value={formData.service_category || 'NONE'}
                                        onValueChange={(val) => handleSelectChange('service_category', val === 'NONE' ? '' : val)}
                                    >
                                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">선택 안함</SelectItem>
                                            <SelectItem value="AIRCON">에어컨 케어</SelectItem>
                                            <SelectItem value="CLEANING">공간 케어</SelectItem>
                                        </SelectContent>
                                    </Select>
                                }
                                label2="서비스 항목"
                                children2={
                                    <Input name="service_type" value={formData.service_type} onChange={handleChange} className="h-9 w-full text-sm" />
                                }
                            />

                            {/* 채널명 */}
                            <FormRow label="채널명">
                                <Select
                                    value={formData.channel_name ? String(formData.channel_name) : 'NONE'}
                                    onValueChange={(val) => handleSelectChange('channel_name', val === 'NONE' ? '' : val)}
                                >
                                    <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="채널 선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">선택 안함</SelectItem>
                                        {channels.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.channel_name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormRow>

                            {/* 결제수단 / 판매금액 */}
                            <FormRowPair
                                label1="결제 수단"
                                children1={
                                    <Select
                                        value={formData.payment_method || 'NONE'}
                                        onValueChange={(val) => handleSelectChange('payment_method', val === 'NONE' ? '' : val)}
                                    >
                                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="결제 수단 선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">선택 안함</SelectItem>
                                            {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.text}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                }
                                label2="판매 금액"
                                children2={
                                    <Input type="text" name="order_price" value={formatNumber(formData.order_price)} onChange={handleNumberChange} placeholder="0" className="h-9 w-full text-right font-medium text-sm" />
                                }
                            />

                            {/* 수수료타입 / 수수료 */}
                            <FormRowPair
                                label1="수수료 타입"
                                children1={
                                    <Select value={formData.commission_type} onValueChange={(val) => handleSelectChange('commission_type', val)}>
                                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="비율">비율(%)</SelectItem>
                                            <SelectItem value="금액">금액(원)</SelectItem>
                                            <SelectItem value="수동">수동</SelectItem>
                                        </SelectContent>
                                    </Select>
                                }
                                label2={formData.commission_type === '비율' ? '수수료 (%)' : '수수료 (원)'}
                                children2={
                                    <Input type="text" name="commission" value={formatNumber(formData.commission)} onChange={handleNumberChange} placeholder="0" className="h-9 w-full text-right font-medium text-sm" />
                                }
                            />

                            {/* 부가세 / 정산금액 */}
                            <FormRowPair
                                label1="부가세"
                                children1={
                                    <Input type="text" name="vat" value={formatNumber(formData.vat)} onChange={handleNumberChange} placeholder="0" className="h-9 w-full text-right font-medium text-sm" />
                                }
                                label2="정산 금액 (지급액)"
                                children2={
                                    <Input
                                        type="text" name="rel_settlement_amount"
                                        value={formatNumber(formData.rel_settlement_amount)}
                                        readOnly={formData.commission_type !== '수동'}
                                        onChange={handleNumberChange}
                                        className={`h-9 w-full text-right font-bold text-sm ${formData.commission_type !== '수동' ? 'bg-slate-50 text-slate-500' : ''}`}
                                    />
                                }
                            />

                            {/* 수수료금액 */}
                            <FormRow label="수수료 금액 (수익)">
                                <Input
                                    type="text" name="rel_commission_amount"
                                    value={formatNumber(formData.rel_commission_amount)}
                                    readOnly={formData.commission_type !== '수동'}
                                    onChange={handleNumberChange}
                                    className={`h-9 w-full sm:max-w-xs text-right font-bold text-sm ${formData.commission_type !== '수동' ? 'bg-slate-50 text-slate-500' : ''}`}
                                />
                            </FormRow>

                            {/* 고객메모 */}
                            <FormRow label="고객 메모">
                                <Textarea name="cstm_memo" value={formData.cstm_memo || ''} onChange={handleChange} className="min-h-[80px] resize-none w-full text-sm" />
                            </FormRow>

                            {/* 관리자메모 - 마지막이라 border-b 제거 */}
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-start">
                                    <div className="bg-slate-50 px-4 py-2.5 sm:py-3 sm:w-36 sm:min-w-[9rem] shrink-0 font-medium text-slate-600 text-sm border-b border-slate-100 sm:border-b-0 sm:border-r sm:border-slate-200">
                                        관리자 메모
                                    </div>
                                    <div className="px-4 py-2.5 sm:py-3 flex-1">
                                        <Textarea name="memo" value={formData.memo || ''} onChange={handleChange} className="min-h-[80px] resize-none w-full text-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 메타데이터 */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                            <FormRowPair
                                label1="등록자"
                                children1={<span className="text-slate-600 text-sm">{formatUserName(order?.user_created)}</span>}
                                label2="등록 일시"
                                children2={<span className="text-slate-600 text-sm">{order?.date_created ? new Date(order.date_created).toLocaleString() : '-'}</span>}
                            />
                            <div className="border-b-0">
                                <FormRowPair
                                    label1="수정자"
                                    children1={<span className="text-slate-600 text-sm">{formatUserName(order?.user_updated)}</span>}
                                    label2="수정 일시"
                                    children2={<span className="text-slate-600 text-sm">{order?.date_updated ? new Date(order.date_updated).toLocaleString() : '-'}</span>}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-200 sm:justify-center gap-2 shrink-0">
                    <Button variant="outline" onClick={onClose} className="px-8 border-slate-300 text-slate-700 hover:bg-slate-100">취소</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="px-8 bg-blue-600 hover:bg-blue-700 text-white">저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}