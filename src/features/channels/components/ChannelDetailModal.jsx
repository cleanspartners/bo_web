
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
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (channel) {
            setFormData({
                channel_name: channel.channel_name || '',
                status: channel.status || '활성화',
            });
        } else {
            setFormData({
                channel_name: '',
                status: '활성화',
            });
        }
    }, [channel, isOpen]);

    const handleSave = async () => {
        if (!formData.channel_name.trim()) {
            alert('채널명을 입력해주세요.');
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
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{channel ? '채널 수정' : '채널 등록'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="channel_name" className="text-right">
                            채널명
                        </Label>
                        <Input
                            id="channel_name"
                            value={formData.channel_name}
                            onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                            className="col-span-3"
                            placeholder="채널명을 입력하세요"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">
                            상태
                        </Label>
                        <Select
                            value={formData.status}
                            onValueChange={(val) => setFormData({ ...formData, status: val })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="상태 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="활성화">활성화</SelectItem>
                                <SelectItem value="비활성화">비활성화</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        취소
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? '저장 중...' : (channel ? '수정' : '등록')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
