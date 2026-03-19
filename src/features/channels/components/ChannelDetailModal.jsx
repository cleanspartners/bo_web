import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import client from '@/lib/directus';
import { createItem, updateItem } from '@directus/sdk';

export default function ChannelDetailModal({ isOpen, onClose, channel, onRefresh }) {
    const [formData, setFormData] = useState({
        channel_name: '',
        status: '활성화',
        channel_fee_rate: 0, // 📍 추가: 기본 수수료율 0%
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (channel) {
            setFormData({
                channel_name: channel.channel_name || '',
                status: channel.status || '활성화',
                channel_fee_rate: channel.channel_fee_rate ?? 0, // 📍 기존 값 반영
            });
        } else {
            setFormData({
                channel_name: '',
                status: '활성화',
                channel_fee_rate: 0,
            });
        }
    }, [channel, isOpen]);

    const handleSave = async () => {
        if (!formData.channel_name.trim()) {
            alert('채널명을 입력해주세요.');
            return;
        }

        // 수수료율 유효성 검사 (0~100 사이)
        const rate = Number(formData.channel_fee_rate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
            alert('수수료율은 0에서 100 사이의 숫자로 입력해주세요.');
            return;
        }

        try {
            setLoading(true);
            if (channel) {
                // Update
                await client.request(updateItem('chnnl_mstr', channel.id, formData));
                alert('수정되었습니다.');
            } else {
                // Create
                await client.request(createItem('chnnl_mstr', formData));
                alert('등록되었습니다.');
            }
            onRefresh();
            onClose();
        } catch (error) {
            console.error('Error saving channel:', error);
            alert('저장 중 오류가 발생했습니다. (Directus 필드 생성 여부를 확인해주세요)');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-white">
                <DialogHeader>
                    <DialogTitle>{channel ? '채널 수정' : '채널 등록'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* 채널명 입력 */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="channel_name" className="text-right font-bold">
                            채널명
                        </Label>
                        <Input
                            id="channel_name"
                            value={formData.channel_name}
                            onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                            className="col-span-3"
                            placeholder="예: 네이버, 당근마켓, 자사"
                        />
                    </div>

                    {/* 📍 수수료율 입력 (추가됨) */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="channel_fee_rate" className="text-right font-bold">
                            수수료율(%)
                        </Label>
                        <div className="col-span-3 flex items-center gap-2">
                            <Input
                                id="channel_fee_rate"
                                type="number"
                                value={formData.channel_fee_rate}
                                onChange={(e) => setFormData({ ...formData, channel_fee_rate: e.target.value })}
                                placeholder="0"
                                min="0"
                                max="100"
                            />
                            <span className="text-sm text-gray-500 font-medium">%</span>
                        </div>
                    </div>

                    {/* 상태 선택 */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right font-bold">
                            상태
                        </Label>
                        <Select
                            value={formData.status}
                            onValueChange={(val) => setFormData({ ...formData, status: val })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="상태 선택" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="활성화">활성화</SelectItem>
                                <SelectItem value="비활성화">비활성화</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 도움말 안내 */}
                    <div className="bg-blue-50 p-3 rounded-md mt-2">
                        <p className="text-xs text-blue-600 leading-relaxed">
                            💡 <strong>0% 입력 시:</strong> 자사 채널로 간주되어 채널 수수료가 발생하지 않습니다.<br />
                            💡 <strong>0% 초과 입력 시:</strong> 해당 비율만큼 채널 수수료가 자동 계산됩니다.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        취소
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? '저장 중...' : (channel ? '수정' : '등록')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}