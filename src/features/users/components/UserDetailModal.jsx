import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Upload, CheckCircle2, XCircle, User as UserIcon, Camera } from "lucide-react";
import client from '@/lib/directus';
import { updateItem, updateUser, createUser, createItem, readUsers, uploadFiles } from '@directus/sdk';

export default function UserDetailModal({ isOpen, onClose, user, userDetail, onUpdate, roles = [] }) {
    // Tab State
    const [activeTab, setActiveTab] = useState('basic');

    // Form Data for Detailed Info (usr_dtl)
    const [formData, setFormData] = useState({});

    // User Basic Info State (directus_users)
    const [basicInfo, setBasicInfo] = useState({
        email: '',
        password: '',
        first_name: '', // 회사명
        last_name: '',  // 팀장명
        title: '',      // 직책
        description: '', // 상세설명
        role: ''
    });

    const [loading, setLoading] = useState(false);

    // Password Update State
    const [showPassword, setShowPassword] = useState(false);

    // Email Check State
    const [isEmailAvailable, setIsEmailAvailable] = useState(null);
    const [emailCheckMessage, setEmailCheckMessage] = useState('');

    // File Upload State (Business License)
    const [selectedFile, setSelectedFile] = useState(null);

    // Avatar State
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);

    const isCreateMode = !user;

    useEffect(() => {
        if (isOpen) {
            // Reset States
            setActiveTab('basic');
            setShowPassword(false);
            setIsEmailAvailable(null);
            setEmailCheckMessage('');
            setSelectedFile(null);
            setAvatarFile(null);
            setAvatarPreview(null);

            if (isCreateMode) {
                // Create Mode: Empty Fields
                setBasicInfo({
                    email: '',
                    password: '',
                    first_name: '', // 회사명
                    last_name: '',  // 팀장명
                    title: '',
                    description: '',
                    role: ''
                });
                setFormData({
                    birth_dt: '',
                    biz_phone: '',
                    biz_address: '',
                    biz_type_item: '',
                    srvc_ctgry: '',
                    actv_rgon: '',
                    exp_years: '',
                    accnt_nmbr: '',
                    biz_licns_file: null
                });
            } else {
                // Edit Mode: Populate Fields
                setBasicInfo({
                    email: user.email || '',
                    password: '', // Password is not retrieved
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    title: user.title || '',
                    description: user.description || '',
                    role: user.role?.id || user.role || ''
                });

                if (user.avatar) {
                    // Check if avatar is object or string ID
                    const avatarId = user.avatar.id || user.avatar;
                    setAvatarPreview(`https://admin.cleanspartners.com/assets/${avatarId}`);
                }

                if (userDetail) {
                    setFormData({
                        birth_dt: userDetail.birth_dt || '',
                        biz_phone: userDetail.biz_phone || '',
                        biz_address: userDetail.biz_address || '',
                        biz_type_item: userDetail.biz_type_item || '',
                        srvc_ctgry: userDetail.srvc_ctgry || '',
                        actv_rgon: userDetail.actv_rgon || '',
                        exp_years: userDetail.exp_years || '',
                        accnt_nmbr: userDetail.accnt_nmbr || '',
                        biz_licns_file: userDetail.biz_licns_file
                    });
                } else {
                    setFormData({});
                }
            }
        }
    }, [isOpen, userDetail, user, isCreateMode]);

    // Handle Basic Info Change
    const handleBasicInfoChange = (e) => {
        const { name, value } = e.target;
        setBasicInfo(prev => ({ ...prev, [name]: value }));

        if (name === 'email' && isCreateMode) {
            setIsEmailAvailable(null);
            setEmailCheckMessage('');
        }
    };

    // Handle Detail Info Change
    const handleDetailChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle Business License File Selection
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    // Handle Avatar Selection
    const handleAvatarChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const checkEmailDuplicate = async () => {
        if (!basicInfo.email) {
            setEmailCheckMessage('이메일을 입력해주세요.');
            setIsEmailAvailable(false);
            return;
        }

        try {
            const existingUsers = await client.request(readUsers({
                filter: { email: { _eq: basicInfo.email } },
                fields: ['id']
            }));

            if (existingUsers.length > 0) {
                setEmailCheckMessage('이미 사용 중인 이메일입니다.');
                setIsEmailAvailable(false);
            } else {
                setEmailCheckMessage('사용 가능한 이메일입니다.');
                setIsEmailAvailable(true);
            }
        } catch (err) {
            console.error(err);
            setEmailCheckMessage('확인 중 오류가 발생했습니다.');
            setIsEmailAvailable(false);
        }
    };

    const handleRoleChange = (newRoleId) => {
        setBasicInfo(prev => ({ ...prev, role: newRoleId }));
    };

    // Upload Helper
    const uploadFile = async (file, folderId = null) => {
        if (!file) return null;
        const formData = new FormData();
        if (folderId) formData.append('folder', folderId);
        formData.append('file', file);

        try {
            const uploadRes = await client.request(uploadFiles(formData));
            return uploadRes.id;
        } catch (error) {
            console.error("Upload failed", error);
            // Retry without folder if failed
            if (folderId && error?.message?.includes('folder')) {
                const retryData = new FormData();
                retryData.append('file', file);
                const retryRes = await client.request(uploadFiles(retryData));
                return retryRes.id;
            }
            return null;
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            let userId = user?.id;

            if (activeTab === 'basic') {
                // === BASIC TAB SAVE (directus_users) ===
                if (isCreateMode) {
                    if (!basicInfo.email || !basicInfo.password || !basicInfo.role) {
                        alert("이메일, 비밀번호, 권한은 필수항목입니다.");
                        setLoading(false);
                        return;
                    }
                    if (isEmailAvailable === false) {
                        alert("이메일 중복 확인이 필요합니다.");
                        setLoading(false);
                        return;
                    }
                }

                // Upload Avatar if needed
                let avatarId = null;
                if (avatarFile) {
                    avatarId = await uploadFile(avatarFile);
                }

                if (isCreateMode) {
                    // Create User
                    const userPayload = {
                        email: basicInfo.email,
                        password: basicInfo.password,
                        first_name: basicInfo.first_name,
                        last_name: basicInfo.last_name,
                        title: basicInfo.title,
                        description: basicInfo.description,
                        role: basicInfo.role,
                        status: 'active', // Enforce Active
                    };
                    if (avatarId) userPayload.avatar = avatarId;

                    await client.request(createUser(userPayload));
                    alert("기본 정보가 등록되었습니다.");
                } else {
                    // Update User
                    const userPayload = {
                        first_name: basicInfo.first_name,
                        last_name: basicInfo.last_name,
                        title: basicInfo.title,
                        description: basicInfo.description,
                        role: basicInfo.role,
                    };
                    if (basicInfo.password) userPayload.password = basicInfo.password;
                    if (avatarId) userPayload.avatar = avatarId;

                    await client.request(updateUser(userId, userPayload));
                    alert("기본 정보가 수정되었습니다.");
                }

            } else if (activeTab === 'detail') {
                // === DETAIL TAB SAVE (usr_dtl) ===
                if (!userId) {
                    alert("기본 정보를 먼저 저장하여 사용자를 생성해주세요.");
                    setActiveTab('basic');
                    setLoading(false);
                    return;
                }

                // Upload Biz License if needed
                let bizLicenseId = formData.biz_licns_file?.id || formData.biz_licns_file;
                if (selectedFile) {
                    bizLicenseId = await uploadFile(selectedFile, 'f3b6bfa4-5332-4757-9a82-3032409d0674');
                }

                const detailPayload = {
                    ...formData,
                    biz_licns_file: bizLicenseId
                };
                delete detailPayload.user_id; // prevent update

                if (!userDetail?.id) {
                    await client.request(createItem('usr_dtl', {
                        user_id: userId,
                        ...detailPayload
                    }));
                } else {
                    await client.request(updateItem('usr_dtl', userDetail.id, detailPayload));
                }
                alert("상세 정보가 저장되었습니다.");
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

    // Helper to get file info
    const getFileId = (file) => file?.id || file;
    const getFileName = (file) => file?.filename_download || file?.title || '파일 보기';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isCreateMode ? "사용자 신규 등록" : "사용자 상세 정보"}</DialogTitle>
                    <DialogDescription>
                        {isCreateMode ? "새로운 사용자를 등록합니다." : `${user?.first_name || ''} ${user?.last_name || ''} (${user?.email || ''}) 님의 정보입니다.`}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="basic">기본 정보</TabsTrigger>
                        <TabsTrigger value="detail">상세 정보</TabsTrigger>
                    </TabsList>

                    {/* --- Basic Info Tab --- */}
                    <TabsContent value="basic" className="space-y-6">

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center justify-center gap-3 mb-6">
                            <div className="relative w-24 h-24 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center group">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-10 h-10 text-slate-300" />
                                )}
                                {/* Overlay Upload Button */}
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <Camera className="w-6 h-6 text-white" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                                </label>
                            </div>
                            <div className="text-center">
                                <label className="cursor-pointer text-xs font-bold text-blue-600 hover:underline">
                                    사진 UPLOAD
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                                </label>
                                <p className="text-[10px] text-slate-400 mt-1">JPG, PNG / 최대 1MB</p>
                            </div>
                        </div>

                        <div className="border rounded-md divide-y divide-slate-100">
                            {/* 1. Company Name */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    회사명 (이름) <span className="text-red-500 ml-1">*</span>
                                </div>
                                <div className="flex-1 p-3">
                                    <Input
                                        name="first_name"
                                        value={basicInfo.first_name}
                                        onChange={handleBasicInfoChange}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>

                            {/* 2. Team Leader Name */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    팀장명 (성)
                                </div>
                                <div className="flex-1 p-3">
                                    <Input
                                        name="last_name"
                                        value={basicInfo.last_name}
                                        onChange={handleBasicInfoChange}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>

                            {/* 3. Title (Position) */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    관계/지위/직책
                                </div>
                                <div className="flex-1 p-3">
                                    <Input
                                        name="title"
                                        value={basicInfo.title}
                                        onChange={handleBasicInfoChange}
                                        placeholder="예: 개발팀"
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>

                            {/* 4. Description */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    상세 설명
                                </div>
                                <div className="flex-1 p-3">
                                    <Textarea
                                        name="description"
                                        value={basicInfo.description}
                                        onChange={handleBasicInfoChange}
                                        placeholder="간단한 설명을 입력하세요."
                                        className="min-h-[60px] text-sm resize-none"
                                    />
                                </div>
                            </div>

                            {/* 5. Email */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    이메일 <span className="text-red-500 ml-1">*</span>
                                </div>
                                <div className="flex-1 p-3">
                                    <div className="flex items-center gap-2">
                                        {isCreateMode ? (
                                            <>
                                                <Input
                                                    name="email"
                                                    value={basicInfo.email}
                                                    onChange={handleBasicInfoChange}
                                                    placeholder="email@example.com"
                                                    className="h-8 text-sm flex-1"
                                                />
                                                <Button type="button" size="sm" onClick={checkEmailDuplicate} className="h-8 text-xs whitespace-nowrap bg-blue-600 hover:bg-blue-700">
                                                    중복확인
                                                </Button>
                                            </>
                                        ) : (
                                            <Input
                                                value={basicInfo.email}
                                                readOnly
                                                className="bg-slate-50 border-none shadow-none h-auto p-0 text-sm focus-visible:ring-0"
                                            />
                                        )}
                                    </div>
                                    {isCreateMode && emailCheckMessage && (
                                        <div className={cn("text-xs mt-1 flex items-center gap-1", isEmailAvailable ? "text-green-600" : "text-red-500")}>
                                            {isEmailAvailable ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {emailCheckMessage}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 7. Password */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    비밀번호
                                </div>
                                <div className="flex-1 p-3">
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            value={basicInfo.password}
                                            onChange={handleBasicInfoChange}
                                            placeholder={isCreateMode ? "비밀번호 입력" : "변경할 경우에만 입력"}
                                            className="h-8 text-sm pr-8"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 8. Role */}
                            <div className="flex">
                                <div className="w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center border-r">
                                    권한 그룹 명 <span className="text-red-500 ml-1">*</span>
                                </div>
                                <div className="flex-1 p-3 flex items-center">
                                    <Select
                                        value={basicInfo.role}
                                        onValueChange={handleRoleChange}
                                    >
                                        <SelectTrigger className="w-full h-8 text-sm focus:ring-0">
                                            <SelectValue placeholder="권한 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map(role => (
                                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- Detail Info Tab --- */}
                    <TabsContent value="detail" className="space-y-4">
                        <div className="border rounded-md divide-y divide-slate-100 bg-white">
                            {/* Improved responsive layout: stack on small screens, flex row on medium+ */}

                            {/* Row 1 */}
                            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="flex-1 flex flex-col md:flex-row">
                                    <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">업무용 연락처</div>
                                    <div className="flex-1 p-3">
                                        <Input name="biz_phone" value={formData.biz_phone || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col md:flex-row">
                                    <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">생년월일</div>
                                    <div className="flex-1 p-3">
                                        <Input type="date" name="birth_dt" value={formData.birth_dt || ''} onChange={handleDetailChange} className="h-8 text-sm w-full block" />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2 */}
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">사업장 주소</div>
                                <div className="flex-1 p-3">
                                    <Input name="biz_address" value={formData.biz_address || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                </div>
                            </div>

                            {/* Row 3 */}
                            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="flex-1 flex flex-col md:flex-row">
                                    <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">업종/업태</div>
                                    <div className="flex-1 p-3">
                                        <Input name="biz_type_item" value={formData.biz_type_item || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col md:flex-row">
                                    <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">서비스 분야</div>
                                    <div className="flex-1 p-3">
                                        <Input name="srvc_ctgry" value={formData.srvc_ctgry || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Row 4 */}
                            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="flex-1 flex flex-col md:flex-row">
                                    <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">활동 지역</div>
                                    <div className="flex-1 p-3">
                                        <Input name="actv_rgon" value={formData.actv_rgon || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col md:flex-row">
                                    <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">경력(년)</div>
                                    <div className="flex-1 p-3">
                                        <Input name="exp_years" value={formData.exp_years || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Row 5 */}
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">계좌번호</div>
                                <div className="flex-1 p-3">
                                    <Input name="accnt_nmbr" value={formData.accnt_nmbr || ''} onChange={handleDetailChange} className="h-8 text-sm" />
                                </div>
                            </div>

                            {/* Row 6 */}
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-32 bg-slate-50 p-3 text-sm font-medium text-slate-600 flex items-center">사업자등록증</div>
                                <div className="flex-1 p-3">
                                    <div className="flex flex-col gap-2">
                                        {(formData.biz_licns_file) && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-slate-500">현재 파일:</span>
                                                <a
                                                    href={`https://admin.cleanspartners.com/assets/${getFileId(formData.biz_licns_file)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {getFileName(formData.biz_licns_file)}
                                                </a>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="file"
                                                onChange={handleFileChange}
                                                className="text-xs h-9 cursor-pointer"
                                            />
                                        </div>
                                        {selectedFile && (
                                            <div className="text-xs text-blue-600 flex items-center gap-1">
                                                <Upload className="w-3 h-3" /> {selectedFile.name} (저장 시 업로드됨)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-8 flex flex-col-reverse sm:flex-row gap-2 sm:justify-center">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-24 mt-2 sm:mt-0">취소</Button>
                    <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 min-w-[6rem]">
                        {loading ? '저장 중...' : (activeTab === 'basic' ? (isCreateMode ? '등록' : '기본정보 저장') : '상세정보 저장')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
