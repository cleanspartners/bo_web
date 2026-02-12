import { useState, useEffect } from 'react';
import { Search, ChevronDown, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { usePartners } from '../hooks/usePartners';

export default function PartnerCombobox({ value, onChange, placeholder = "파트너 선택", disabled = false }) {
    const { partners, loading } = usePartners();
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPartners = partners.filter(p => {
        const query = searchQuery.toLowerCase();
        return (
            (p.first_name && p.first_name.toLowerCase().includes(query)) ||
            (p.last_name && p.last_name.toLowerCase().includes(query)) ||
            (p.email && p.email.toLowerCase().includes(query)) ||
            (p.actv_rgon && p.actv_rgon.toLowerCase().includes(query))
        );
    });

    const selectedPartner = partners.find(p => p.id === value);

    const getDisplayName = () => {
        if (!selectedPartner) return placeholder;
        return `${selectedPartner.first_name || ''}(${selectedPartner.last_name || ''}) - ${selectedPartner.actv_rgon || '미지정'}`;
    };

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
                        {getDisplayName()}
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
                            placeholder="파트너 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-1">
                    {loading ? (
                        <div className="py-4 text-center text-xs text-slate-500">로딩 중...</div>
                    ) : filteredPartners.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">검색 결과가 없습니다.</div>
                    ) : (
                        filteredPartners.map((partner) => (
                            <div
                                key={partner.id}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100",
                                    value === partner.id ? "bg-slate-100" : ""
                                )}
                                onClick={() => {
                                    onChange(partner.id);
                                    setOpen(false);
                                    setSearchQuery('');
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === partner.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium truncate">
                                        {partner.first_name}({partner.last_name}) - {partner.actv_rgon || '미지정'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
