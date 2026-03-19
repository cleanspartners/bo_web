import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import client from '@/lib/directus';
import { readItems } from '@directus/sdk';

export default function OrderImportModal({ isOpen, onClose, onUpdate }) {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [parsedData, setParsedData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successCount, setSuccessCount] = useState(0);
    const [step, setStep] = useState('upload'); // upload, preview, result

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseExcel(selectedFile);
        }
    };

    const parseExcel = (file) => {
        setLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    setError("데이터가 없는 파일입니다.");
                    setLoading(false);
                    return;
                }

                // 채널 목록 조회 (채널명 → ID 변환용)
                const channelList = await client.request(readItems('chnnl_mstr', {
                    fields: ['id', 'channel_name'],
                    filter: { del_yn: { _neq: 'Y' } },
                    limit: -1,
                }));
                // { '클린스파트너스(오프라인)': 1, ... } 형태의 맵 생성
                const channelNameToId = {};
                channelList.forEach(ch => {
                    channelNameToId[ch.channel_name] = ch.id;
                });

                // Data Mapping & Transformation
                const mappedData = jsonData.map(row => {
                    const parseNumber = (val) => {
                        if (!val) return 0;
                        if (typeof val === 'number') return val;
                        return Number(String(val).replace(/,/g, '')) || 0;
                    };

                    const channelNameText = row['channel_name.channel_name'] || row['channel_name'] || '';
                    const channelId = channelNameToId[channelNameText] ?? null;

                    return {
                        customer_name: row['customer_name'] || '',
                        order_date: row['order_date'] ? formatDate(row['order_date']) : null,
                        phone: row['phone'] || '',
                        address: row['address'] || '',
                        service_type: row['service_type'] || '',
                        service_category: row['service_category'] || '',
                        channel_name: channelId,
                        _channel_name_text: channelNameText, // 미리보기 표시용
                        partner: row['partner'] || 'd6e6568c-48f0-4951-89e5-1c88421de160',
                        status: row['status'] || '접수',
                        order_price: parseNumber(row['order_price']) || 0,
                        commission: parseNumber(row['commission']) || 0,
                        rel_settlement_amount: parseNumber(row['rel_settlement_amount']) || 0,
                        rel_commission_amount: parseNumber(row['rel_commission_amount']) || 0,
                        channel_fee_amount: parseNumber(row['channel_fee_amount']) || 0, // ✅ 추가
                        net_profit: parseNumber(row['net_profit']) || 0, // ✅ 추가
                        cstm_memo: row['cstm_memo'] || row['상담메모'] || '',
                    };
                });

                setParsedData(mappedData);
                setPreviewData(mappedData.slice(0, 5)); // Show first 5 rows
                setStep('preview');
            } catch (err) {
                console.error("Excel Parse Error:", err);
                setError("엑셀 파일을 읽는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Helper to format date strictly as YYYY-MM-DD HH:mm:ss
    // Defaults to current time if invalid or missing
    const formatDate = (val) => {
        let date;
        if (!val) {
            date = new Date(); // Default case
        } else if (val instanceof Date) {
            date = val;
        } else {
            // Try to parse string or number
            const parsed = new Date(val);
            if (isNaN(parsed.getTime())) {
                // Manual parsing for "YYYY-MM-DD HH:mm:ss" format
                const parts = String(val).split(/[- :]/);
                if (parts.length >= 3) {
                    date = new Date(parts[0], parts[1] - 1, parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0);
                } else {
                    date = new Date();
                }
            } else {
                date = parsed;
            }
        }

        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    const handleUpload = async () => {
        if (!parsedData.length) return;

        setLoading(true);
        try {
            const formData = new FormData();

            // _channel_name_text는 미리보기용 내부 필드이므로 DB 전송 전 제거
            const uploadData = parsedData.map(({ _channel_name_text, ...rest }) => rest);

            // Create a JSON file from the parsed data
            const jsonBlob = new Blob([JSON.stringify(uploadData)], { type: 'application/json' });
            formData.append('file', jsonBlob, 'import_data.json');

            // 📍 로컬/프로덕션 환경에 따른 API URL 설정
            const API_BASE = import.meta.env.DEV ? '/utils' : 'https://api.cleanspartners.com/utils';

            const response = await fetch(`${API_BASE}/import/ord_mstr`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await client.getToken()}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed (${response.status}): ${errorText || response.statusText}`);
            }

            const responseText = await response.text();
            let result;
            try {
                result = responseText ? JSON.parse(responseText) : { data: 'success' };
            } catch (e) {
                console.warn("Response is not JSON:", responseText);
                result = { data: 'success' };
            }

            setSuccessCount(parsedData.length);
            setStep('result');
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Upload API Error:", err);
            setError("데이터 업로드 중 오류가 발생했습니다: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetModal = () => {
        setFile(null);
        setPreviewData([]);
        setParsedData([]);
        setError(null);
        setStep('upload');
        setSuccessCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>엑셀 일괄 등록</DialogTitle>
                    <DialogDescription className="sr-only">
                        엑셀 파일을 업로드하여 주문을 일괄 등록합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[300px] p-1">
                    {step === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-10">
                            <FileUp className="w-16 h-16 text-slate-300 mb-4" />
                            <p className="text-slate-600 mb-6 text-center">
                                엑셀 파일(.xlsx, .xls)을 이곳에 드래그하거나<br />
                                아래 버튼을 눌러 선택해주세요.
                            </p>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                                {loading ? '파일 읽는 중...' : '파일 선택'}
                            </Button>
                            {error && (
                                <div className="mt-4 text-sm text-red-500 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-slate-700">데이터 미리보기 (상위 5건)</h3>
                                <span className="text-xs text-slate-500">총 {parsedData.length}건</span>
                            </div>
                            <div className="border rounded-md overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>고객명</TableHead>
                                            <TableHead>요청일시</TableHead>
                                            <TableHead>연락처</TableHead>
                                            <TableHead>대분류</TableHead>
                                            <TableHead>채널명</TableHead>
                                            <TableHead>서비스</TableHead>
                                            <TableHead>작업상태</TableHead>
                                            <TableHead className="text-right">판매금액</TableHead>
                                            <TableHead className="text-right">수수료</TableHead>
                                            <TableHead className="text-right">정산금액</TableHead>
                                            <TableHead className="text-right">수수료금액</TableHead>
                                            <TableHead className="text-right">공급업체수수료</TableHead>
                                            <TableHead className="text-right">최종순이익</TableHead>
                                            <TableHead>상담메모</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.map((row, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{row.customer_name}</TableCell>
                                                <TableCell>{row.order_date}</TableCell>
                                                <TableCell>{row.phone}</TableCell>
                                                <TableCell>{row.service_category}</TableCell>
                                                <TableCell>{row._channel_name_text}{row.channel_name ? ` (ID: ${row.channel_name})` : ' ⚠️ 미매칭'}</TableCell>
                                                <TableCell>{row.service_type}</TableCell>
                                                <TableCell>{row.status}</TableCell>
                                                <TableCell className="text-right">{row.order_price?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{row.commission?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{row.rel_settlement_amount?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{row.rel_commission_amount?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{row.channel_fee_amount?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{row.net_profit?.toLocaleString()}</TableCell>
                                                <TableCell>{row.cstm_memo}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm">
                                💡 <strong>partner</strong> ID와 <strong>status</strong>는 엑셀 파일의 값을 그대로 전송합니다. 데이터가 정확한지 확인해주세요.
                            </div>
                            {error && (
                                <div className="text-sm text-red-500 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="h-full flex flex-col items-center justify-center p-10">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 mb-2">등록 완료!</h3>
                            <p className="text-slate-600">
                                총 <strong>{successCount}</strong>건의 데이터가 성공적으로 등록되었습니다.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    {step === 'upload' && (
                        <Button variant="outline" onClick={handleClose}>취소</Button>
                    )}
                    {step === 'preview' && (
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="outline" onClick={resetModal} disabled={loading}>다시 선택</Button>
                            <Button onClick={handleUpload} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                {loading ? '업로드 중...' : '업로드 시작'}
                            </Button>
                        </div>
                    )}
                    {step === 'result' && (
                        <Button onClick={handleClose} className="bg-slate-800 hover:bg-slate-900">닫기</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}