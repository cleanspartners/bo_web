import { useState } from 'react';
import { Search, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useChannels } from '../hooks/useChannels';

export default function ChannelCombobox({ value, onChange, placeholder = "채널 선택", disabled = false }) {
    const { channels, loading } = useChannels();
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredChannels = channels.filter(c =>
        c.channel_name && c.channel_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedChannel = channels.find(c => c.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-[34px] px-2 py-1.5 text-sm border-gray-300 font-normal hover:bg-white"
                    disabled={disabled}
                >
                    <span className="truncate">
                        {selectedChannel ? selectedChannel.channel_name : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="p-2 border-b">
                    <div className="flex items-center px-2 border rounded-md bg-slate-50">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-8 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="채널 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-1">
                    {loading ? (
                        <div className="py-4 text-center text-xs text-slate-500">로딩 중...</div>
                    ) : filteredChannels.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">검색 결과가 없습니다.</div>
                    ) : (
                        filteredChannels.map((channel) => (
                            <div
                                key={channel.id}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100",
                                    value === channel.id ? "bg-slate-100" : ""
                                )}
                                onClick={() => {
                                    onChange(channel.id);
                                    setOpen(false);
                                    setSearchQuery('');
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === channel.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <span className="font-medium truncate">
                                    {channel.channel_name}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
