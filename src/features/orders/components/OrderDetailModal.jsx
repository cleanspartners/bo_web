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

// ✅ 컴포넌트 밖에 정의해야 re-render 시 unmount/remount 없이 포커스 유지됨
const NumberInput = ({ name, value, readOnly, className, placeholder = "0", focusedField, setFocusedField, onChange, formatNumber }) => {
    const displayValue = focusedField === name ? value : formatNumber(value);
    return (
        <Input
            type="text"
            name={name}
            value={displayValue}
            onChange={onChange}
            onFocus={() => setFocusedField(name)}
            onBlur={() => setFocusedField(null)}
            readOnly={readOnly}
            placeholder={placeholder}
            className={className}
        />
    );
};

const FormRow = ({ label, children }) => (
    <div className="border-b border-slate-200">
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

const FormRowPair = ({ label1, children1, label2, children2 }) => (
    <div className="border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:divide-x sm:divide-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:w-1/2 border-b border-slate-100 sm:border-b-0">
                <div className="bg-slate-50 px-4 py-2.5 sm:py-3 sm:w-36 sm:min-w-[9rem] shrink-0 font-medium text-slate-600 text-sm border-b border-slate-100 sm:border-b-0 sm:border-r sm:border-slate-200">
                    {label1}
                </div>
                <div className="px-4 py-2.5 sm:py-3 flex-1 min-w-0 overflow-hidden">
                    {children1}
                </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:w-1/2">
                <div className="bg-slate-50 px-4 py-2.5 sm:py-3 sm:w-36 sm:min-w-[9rem] shrink-0 font-medium text-slate-600 text-sm border-b border-slate-100 sm:border-b-0 sm:border-r sm:border-slate-200">
                    {label2}
                </div>
                <div className="px-4 py-2.5 sm:py-3 flex-1 min-w-0 overflow-hidden">
                    {children2}
                </div>
            </div>
        </div>
    </div>
);

export default function OrderDetailModal({ isOpen, onClose, orderId, onUpdate }) {
    const { statuses: ORDER_STATUSES } = useOrderStatuses();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({});
    const [initialOrder, setInitialOrder] = useState({});
    const [channels, setChannels] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);

    // 포커스된 입력 필드 추적
    const [focusedField, setFocusedField] = useState(null);

    // ✅ 초기 로드 중인지 추적
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchChannels();
            fetchPaymentMethodField();
            if (orderId) {
                setIsInitialLoad(true); // ✅ 수정 모드: 초기 로드 활성화
                fetchOrder();
            } else {
                setIsInitialLoad(false); // ✅ 신규 등록: 바로 자동 계산 활성화
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
                    channel_fee_amount: 0,
                    net_profit: 0,
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
                limit: 100,
                fields: ['id', 'channel_name', 'channel_fee_rate'],
                filter: { del_yn: { _neq: 'Y' } },
                sort: ['channel_name']
            }));
            setChannels(response);
        } catch (error) {
            console.error("채널 목록 조회 실패:", error);
        }
    };

    const fetchPaymentMethodField = async () => {
        try {
            const response = await client.request(readField('ord_mstr', 'payment_method'));
            setPaymentMethods(response.meta?.options?.choices || []);
        } catch (error) {
            console.error("결제 수단 필드 정보 로드 실패:", error);
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
                channel_fee_amount: response.channel_fee_amount || 0,
                net_profit: response.net_profit || 0,
                cstm_memo: response.cstm_memo || '',
                memo: response.memo || '',
            };
            setFormData(initialData);
            setInitialOrder(initialData);

            // ✅ 데이터 로드 완료 후 100ms 뒤 자동 계산 활성화
            setTimeout(() => {
                setIsInitialLoad(false);
            }, 100);
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

            // 채널 변경 시 공급업체 수수료 자동 계산
            if (name === 'channel_name') {
                const selectedChannel = channels.find(c => String(c.id) === String(value));
                const channelFeeRate = selectedChannel?.channel_fee_rate || 0;
                const orderPrice = Number(prev.order_price || 0);
                const vat = Number(prev.vat || 0);
                const purePrice = orderPrice - vat;

                // ✅ 공급업체 수수료 = 순수금액 × 채널 수수료율
                newData.channel_fee_amount = Math.floor(purePrice * (channelFeeRate / 100));

                // ✅ 최종 순이익 계산
                // rel_commission_amount가 부가세 포함이면 제외하고 계산
                const baseCommission = prev.payment_method === 'BILLING_DOC'
                    ? (Number(prev.rel_commission_amount) || 0) - vat
                    : (Number(prev.rel_commission_amount) || 0);
                newData.net_profit = baseCommission - newData.channel_fee_amount;
            }

            return newData;
        });
    };

    const formatNumber = (num) => {
        if (!num && num !== 0) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const handleNumberChange = (e) => {
        const { name, value } = e.target;
        const rawValue = value.replace(/,/g, '');
        if (rawValue && isNaN(rawValue)) return;

        const numValue = rawValue === '' ? 0 : Number(rawValue);
        setFormData(prev => ({ ...prev, [name]: numValue }));
    };

    // 팀장 수수료 자동 계산
    useEffect(() => {
        // ✅ 초기 로드 중이거나 수동 모드면 계산 안 함
        if (isInitialLoad || formData.commission_type === '수동') return;

        const orderPrice = Number(formData.order_price) || 0;
        const vat = Number(formData.vat) || 0;
        // ✅ 부가세 제외 순수 금액
        const purePrice = orderPrice - vat;
        const commissionVal = Number(formData.commission) || 0;

        let settlementAmount = 0;
        let commissionAmount = 0;
        let relCommissionAmount = 0;

        if (formData.commission_type === '비율') {
            // ✅ 팀장 정산수수료 = 순수금액 × 팀장 비율
            commissionAmount = Math.floor(purePrice * (commissionVal / 100));
            settlementAmount = purePrice - commissionAmount;
        } else {
            // 금액 타입
            commissionAmount = commissionVal;
            settlementAmount = purePrice - commissionVal;
        }

        // ✅ 세금계산서일 경우 팀장 정산수수료에 부가세 포함
        relCommissionAmount = formData.payment_method === 'BILLING_DOC'
            ? commissionAmount + vat
            : commissionAmount;

        setFormData(prev => {
            if (prev.rel_settlement_amount === settlementAmount &&
                prev.rel_commission_amount === relCommissionAmount) return prev;

            // ✅ 공급업체 수수료 = 순수금액 × 채널 수수료율
            const selectedChannel = channels.find(c => String(c.id) === String(prev.channel_name));
            const channelFeeRate = selectedChannel?.channel_fee_rate || 0;
            const channelFeeAmount = Math.floor(purePrice * (channelFeeRate / 100));

            // ✅ 최종 순이익 = 팀장 정산수수료(부가세 제외) - 공급업체 수수료
            const netProfit = commissionAmount - channelFeeAmount;

            return {
                ...prev,
                rel_settlement_amount: settlementAmount,
                rel_commission_amount: relCommissionAmount,
                channel_fee_amount: channelFeeAmount,
                net_profit: netProfit
            };
        });
    }, [
        isInitialLoad, // ✅ 의존성 추가
        formData.order_price,
        formData.commission,
        formData.commission_type,
        formData.vat,
        formData.payment_method,
        formData.channel_name,
        channels
    ]);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            if (!formData.customer_name) {
                alert("고객명을 입력해주세요.");
                setLoading(false);
                return;
            }

            if (orderId) {
                const payload = {};
                Object.keys(formData).forEach(key => {
                    if (formData[key] !== initialOrder[key]) payload[key] = formData[key];
                });
                if (Object.keys(payload).length === 0) {
                    alert("변경된 내용이 없습니다.");
                    setLoading(false);
                    return;
                }
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

                            {/* 채널명 / 공급업체 수수료 */}
                            <FormRowPair
                                label1="채널명 (공급업체)"
                                children1={
                                    <Select
                                        value={formData.channel_name ? String(formData.channel_name) : 'NONE'}
                                        onValueChange={(val) => handleSelectChange('channel_name', val === 'NONE' ? '' : val)}
                                    >
                                        <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="채널 선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">선택 안함</SelectItem>
                                            {channels.map(c => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    {c.channel_name} {c.channel_fee_rate > 0 && `(${c.channel_fee_rate}%)`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                }
                                label2="공급업체 수수료"
                                children2={
                                    <NumberInput
                                        name="channel_fee_amount"
                                        value={formData.channel_fee_amount}
                                        className="h-9 w-full text-right font-bold text-sm bg-slate-50 text-red-600"
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                            />

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
                                    <NumberInput
                                        name="order_price"
                                        value={formData.order_price}
                                        className="h-9 w-full text-right font-medium text-sm"
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                            />

                            {/* 팀장 수수료타입 / 팀장 수수료 */}
                            <FormRowPair
                                label1="팀장 수수료 타입"
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
                                label2={formData.commission_type === '비율' ? '팀장 수수료 (%)' : '팀장 수수료 (원)'}
                                children2={
                                    <NumberInput
                                        name="commission"
                                        value={formData.commission}
                                        className="h-9 w-full text-right font-medium text-sm"
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                            />

                            {/* 부가세 / 팀장 정산금액 */}
                            <FormRowPair
                                label1="부가세"
                                children1={
                                    <NumberInput
                                        name="vat"
                                        value={formData.vat}
                                        className="h-9 w-full text-right font-medium text-sm"
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                                label2="팀장 정산금액 (팀장)"
                                children2={
                                    <NumberInput
                                        name="rel_settlement_amount"
                                        value={formData.rel_settlement_amount}
                                        readOnly={formData.commission_type !== '수동'}
                                        className={`h-9 w-full text-right font-bold text-sm ${formData.commission_type !== '수동' ? 'bg-slate-50 text-slate-500' : ''}`}
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                            />

                            {/* 팀장 정산수수료 / 최종 순이익 */}
                            <FormRowPair
                                label1="팀장 정산수수료 (우리 수취)"
                                children1={
                                    <NumberInput
                                        name="rel_commission_amount"
                                        value={formData.rel_commission_amount}
                                        readOnly={formData.commission_type !== '수동'}
                                        className={`h-9 w-full text-right font-bold text-sm ${formData.commission_type !== '수동' ? 'bg-slate-50 text-slate-500' : ''}`}
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                                label2="최종 순이익"
                                children2={
                                    <NumberInput
                                        name="net_profit"
                                        value={formData.net_profit}
                                        readOnly={true}
                                        className="h-9 w-full text-right font-bold text-lg bg-blue-50 text-blue-700 border-blue-200"
                                        focusedField={focusedField}
                                        setFocusedField={setFocusedField}
                                        onChange={handleNumberChange}
                                        formatNumber={formatNumber}
                                    />
                                }
                            />

                            {/* 고객메모 */}
                            <FormRow label="고객 메모">
                                <Textarea name="cstm_memo" value={formData.cstm_memo || ''} onChange={handleChange} className="min-h-[80px] resize-none w-full text-sm" />
                            </FormRow>

                            {/* 관리자메모 */}
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
                    <Button variant="outline" onClick={onClose} className="px-8 border-slate-300 text-slate-700 hover:bg-slate-100">닫기</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="px-8 bg-blue-600 hover:bg-blue-700 text-white">저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}