import { CalendarDays, ListChecks, MessageSquare, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { id: "calendar", label: "일정관리", icon: CalendarDays },
    { id: "reservations", label: "예약관리", icon: ListChecks },
    // { id: "messages", label: "메시지", icon: MessageSquare },
    { id: "profile", label: "내 정보", icon: UserCircle },
];

export function BottomNav({ activeTab, onTabChange }) {
    return (
        <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 pb-safe z-50">
            {NAV_ITEMS.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                        "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                        activeTab === item.id ? "text-blue-600" : "text-gray-400"
                    )}
                >
                    <item.icon className="w-6 h-6" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                </button>
            ))}
        </nav>
    );
}