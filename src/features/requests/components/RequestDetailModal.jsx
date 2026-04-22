import { useState, useEffect, useCallback } from 'react';
import client from '@/lib/directus';
import { readItem, createItem, updateItem } from '@directus/sdk';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, User, Calendar, MessageSquare, Send, CheckCircle2, AlertCircle, Clock, XCircle, Loader2, Trash2, ExternalLink, X, Camera, ZoomIn } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRequestOptions } from '../hooks/useRequestOptions';
import { useRequests } from '../hooks/useRequests';

const STATUS_STYLE_MAP = {
    'published': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
    'progress': { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle },
    'completed': { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
    'rejected': { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle }
};

export default function RequestDetailModal({ isOpen, onClose, requestId, onUpdate }) {
    const { statuses } = useRequestOptions();
    const { deleteAnswer } = useRequests();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(false);
    const [answerText, setAnswerText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchDetail = useCallback(async () => {
        if (!requestId) return;
        try {
            setLoading(true);
            const data = await client.request(readItem('rqst_mstr', requestId, {
                fields: [
                    '*',
                    'user_created.first_name',
                    'user_created.last_name',
                    'files.*',
                    'ord_id.*',
                    { rqst_ans_list: ['*', 'user_created.first_name', 'user_created.last_name', 'user_created.role'] }
                ]
            }));
            
            if (data.rqst_ans_list) {
                data.rqst_ans_list.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));
            }
            
            setRequest(data);
        } catch (error) {
            console.error("요청 상세 로드 실패:", error);
            alert("삭제된 요청이거나 권한이 없습니다.");
            onClose();
        } finally {
            setLoading(false);
        }
    }, [requestId, onClose]);

    useEffect(() => {
        if (isOpen && requestId) {
            fetchDetail();
        }
    }, [isOpen, requestId, fetchDetail]);

    const handleStatusUpdate = async (newStatus) => {
        try {
            await client.request(updateItem('rqst_mstr', requestId, { status: newStatus }));
            await fetchDetail();
            onUpdate?.();
        } catch (error) {
            console.error("상태 업데이트 실패:", error);
            alert("상태 변경 중 오류가 발생했습니다.");
        }
    };

    const handleSendAnswer = async () => {
        if (!answerText.trim()) return;
        try {
            setIsSubmitting(true);
            await client.request(createItem('rqst_ans_dtl', {
                rqst_id: requestId,
                rqst_ans: answerText
            }));
            setAnswerText("");
            await fetchDetail();
            onUpdate?.();
        } catch (error) {
            console.error("답변 등록 실패:", error);
            alert("답변 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("정말로 이 요청을 삭제하시겠습니까?")) return;
        try {
            setIsSubmitting(true);
            await client.request(updateItem('rqst_mstr', requestId, { del_yn: 'Y' }));
            alert("삭제되었습니다.");
            onUpdate?.();
            onClose();
        } catch (error) {
            console.error("삭제 실패:", error);
            alert("삭제 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAnswer = async (ansId) => {
        if (!window.confirm("정말로 이 댓글을 삭제하시겠습니까? (관리자 권한)")) return;
        try {
            await deleteAnswer(ansId);
            await fetchDetail(); // 목록 새로고침
        } catch (error) {
            alert("삭제에 실패했습니다.");
        }
    };

    if (!isOpen) return null;

    const currentStatus = statuses.find(s => s.value === request?.status) || (statuses.length > 0 ? statuses[0] : { text: request?.status, color: 'bg-gray-100' });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] sm:max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col p-0 text-gray-900 border-none shadow-2xl">
                <DialogTitle className="sr-only">요청 상세 모달</DialogTitle>
                <DialogDescription className="sr-only">요청의 상세 내용과 처리 히스토리를 확인하고 관리할 수 있습니다.</DialogDescription>
                <DialogHeader className="p-4 sm:p-6 border-b bg-gray-50/50">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-100 font-bold px-2 py-0.5">{request?.type || '유형 없음'}</Badge>
                                <DialogTitle className="text-lg sm:text-xl font-bold">요청 상세 정보</DialogTitle>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-gray-400">
                                <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span className="font-medium">{request?.user_created?.first_name || ''} {request?.user_created?.last_name || '파트너'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 opacity-50" />
                                    {request?.date_created ? format(parseISO(request.date_created), 'yyyy-MM-dd HH:mm') : '-'} 등록
                                </div>
                            </div>
                        </div>
                        
                        {/* 상태 변경 버튼군 - 모바일 가로 스크롤 대응 */}
                        <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            <div className="flex gap-2 p-1 bg-white border rounded-lg shadow-sm w-fit">
                            {statuses.map(opt => {
                                const style = STATUS_STYLE_MAP[opt.value] || { color: 'text-gray-400', icon: Clock };
                                const Icon = style.icon;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleStatusUpdate(opt.value)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            request?.status === opt.value 
                                            ? style.color + ' ring-1 ring-inset ring-current'
                                            : 'text-gray-400 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {opt.text}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 bg-white">
                    {/* 왼쪽: 요청 내용 및 첨부파일 */}
                    <div className="space-y-6">
                        {/* 요청 일자 필드 디자인 간소화 (파란색 제거) */}
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200 shadow-sm">
                                    <Calendar className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">요청 일자</p>
                                    <p className="text-lg font-bold text-gray-900">{request?.rqst_dt ? request.rqst_dt.split('T')[0] : '-'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">현재 상태</p>
                                <Badge className={`${currentStatus.color} font-bold text-[10px] px-2 py-0.5`}>{currentStatus.text}</Badge>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                요청 내용
                            </h3>
                            <div className="bg-gray-50 p-5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap border border-gray-100 min-h-[150px]">
                                {request?.rqst_cont || '내용이 없습니다.'}
                            </div>
                        </div>

                        {/* 관련 주문 정보 */}
                        {request?.ord_id && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                    <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-tight">관련 주문</h4>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-bold text-blue-900">{request.ord_id.customer_name}</div>
                                        <div className="text-xs text-blue-600">{request.ord_id.service_type} | {request.ord_id.order_date?.split('T')[0]}</div>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="bg-white text-xs h-7 gap-1 shadow-sm border-blue-100 hover:bg-blue-50" 
                                        onClick={() => window.open(`/orders?id=${request.ord_id.id}`, '_blank')}
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        상세보기
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* 첨부 파일 섹션 (단일 파일 M2O 지원) */}
                        {request?.files && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                    첨부 파일
                                </h3>
                                <div className="max-w-[200px]">
                                    {(() => {
                                        const file = request.files; // 단일 객체
                                        const isImage = file.type?.startsWith('image/');
                                        const fileUrl = `https://api.cleanspartners.com/assets/${file.id}`;
                                        
                                        return (
                                            <div className="group relative border rounded-xl overflow-hidden bg-white shadow-sm hover:ring-2 hover:ring-blue-500 transition-all">
                                                {isImage ? (
                                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="aspect-square block cursor-zoom-in">
                                                        <img src={fileUrl} alt="attachment" className="w-full h-full object-cover" />
                                                    </a>
                                                ) : (
                                                    <div className="aspect-square flex flex-col items-center justify-center p-2 text-center">
                                                        <FileText className="w-8 h-8 text-gray-300 mb-1" />
                                                        <span className="text-[10px] text-gray-500 truncate w-full px-2">{file.filename_download}</span>
                                                    </div>
                                                )}
                                                <a 
                                                    href={fileUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur shadow-sm rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-gray-700 hover:text-blue-600 transition-all"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 오른쪽: 진행 히스토리 (답변) */}
                    <div className="flex flex-col h-auto lg:h-full lg:border-l lg:pl-8 pt-8 lg:pt-0 border-t lg:border-t-0 mt-2 lg:mt-0">
                        <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                            진행 히스토리
                        </h3>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
                            {request?.rqst_ans_list?.map((ans) => {
                                // 📍 관리자 식별 로직 보강 (역할 ID 혹은 이름에 '관리자' 포함 여부)
                                const isAdmin = 
                                    ans.user_created?.role === '98e02b78-6ee2-4ebf-9b5e-bedc4f06c6f3' || 
                                    ans.user_created?.first_name?.includes('관리자') || 
                                    ans.user_created?.last_name?.includes('관리자') ||
                                    !ans.user_created?.first_name;
                                
                                return (
                                    <div key={ans.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            <button 
                                                onClick={() => handleDeleteAnswer(ans.id)}
                                                className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                                                title="댓글 삭제"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                            <span className={`text-[11px] font-bold ${isAdmin ? 'text-blue-600' : 'text-gray-500'}`}>
                                                {isAdmin ? '운영팀' : `${ans.user_created?.first_name || ''} ${ans.user_created?.last_name || '파트너'}`}
                                            </span>
                                            <span className="text-[9px] text-gray-300">
                                                {format(parseISO(ans.date_created), 'MM-dd HH:mm')}
                                            </span>
                                        </div>
                                        <div className={`max-w-[90%] p-3 text-[13px] rounded-2xl shadow-sm ${
                                            isAdmin 
                                            ? 'bg-blue-600 text-white rounded-tr-none ring-1 ring-blue-500' 
                                            : 'bg-white text-gray-700 rounded-tl-none border border-gray-100'
                                        }`}>
                                            {ans.rqst_ans}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {(!request?.rqst_ans_list || request.rqst_ans_list.length === 0) && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 py-10">
                                    <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-xs">답변 내역이 없습니다.</p>
                                </div>
                            )}
                        </div>

                        {/* 답변 입력 */}
                        <div className="pt-4 mt-auto border-t">
                            <div className="relative">
                                <Textarea 
                                    placeholder="답변 내용을 입력하세요..."
                                    className="resize-none pr-12 min-h-[80px] bg-gray-50 border-none focus-visible:ring-1 focus-visible:ring-blue-100 text-sm"
                                    value={answerText}
                                    onChange={(e) => setAnswerText(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendAnswer();
                                        }
                                    }}
                                />
                                <Button 
                                    className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                                    disabled={!answerText.trim() || isSubmitting}
                                    onClick={handleSendAnswer}
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                                </Button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 px-1">
                                엔터(Enter) 기입 시 즉시 전송됩니다. 줄바꿈은 Shift + Enter.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-gray-50/50 flex justify-between items-center sm:justify-between">
                    <Button 
                        variant="ghost" 
                        onClick={handleDelete} 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold text-xs gap-1.5"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        요청 삭제
                    </Button>
                    <Button variant="outline" onClick={onClose} className="bg-white">닫기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
