import client from "@/lib/directus";
import { readItems, readItem, createItem, updateItem, deleteItem, uploadFiles } from "@directus/sdk";
import { useCallback } from "react";

export function useRequests() {
    // 요청 목록 조회
    const fetchRequests = useCallback(async ({ page = 1, limit = 15, filter = {} }) => {
        try {
            const response = await client.request(readItems('rqst_mstr', {
                filter,
                sort: ['-date_created'],
                limit,
                page,
                fields: ['*', 'user_created.first_name', 'user_created.last_name', { rqst_ans_list: ['id'] }]
            }));
            return response;
        } catch (error) {
            console.error("요청 목록 로드 실패:", error);
            throw error;
        }
    }, []);

    // 요청 상세 조회
    const fetchRequestDetail = useCallback(async (id) => {
        try {
            const response = await client.request(readItem('rqst_mstr', id, {
                fields: [
                    '*',
                    'user_created.first_name',
                    'user_created.last_name',
                    'files.*',
                    { ord_id: ['id', 'customer_name', 'service_type', 'order_date'] },
                    { rqst_ans_list: ['*', 'user_created.first_name', 'user_created.last_name', 'user_created.role'] }
                ]
            }));
            
            if (response.rqst_ans_list) {
                response.rqst_ans_list.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));
            }
            
            return response;
        } catch (error) {
            console.error("요청 상세 로드 실패:", error);
            throw error;
        }
    }, []);

    // 요청 생성
    const createRequest = useCallback(async (data) => {
        try {
            const response = await client.request(createItem('rqst_mstr', data));
            return response;
        } catch (error) {
            console.error("요청 생성 실패:", error);
            throw error;
        }
    }, []);

    // 답변 생성
    const createAnswer = useCallback(async (requestId, answerText) => {
        try {
            const response = await client.request(createItem('rqst_ans_dtl', {
                rqst_id: requestId,
                rqst_ans: answerText
            }));
            return response;
        } catch (error) {
            console.error("답변 생성 실패:", error);
            throw error;
        }
    }, []);

    // 파일 업로드
    const uploadRequestFiles = useCallback(async (files) => {
        try {
            const formData = new FormData();
            const folderId = "8d7337cb-3057-4c8e-9f4c-70805c15ddf0";
            formData.append('folder', folderId);
            
            files.forEach(file => {
                formData.append('files', file);
            });
            
            const response = await client.request(uploadFiles(formData));
            return Array.isArray(response) ? response : [response];
        } catch (error) {
            console.error("파일 업로드 실패:", error);
            throw error;
        }
    }, []);

    const updateRequestStatus = useCallback(async (id, status) => {
        try {
            const response = await client.request(updateItem('rqst_mstr', id, { status }));
            return response;
        } catch (error) {
            console.error("상태 업데이트 실패:", error);
            throw error;
        }
    }, []);

    const updateRequest = useCallback(async (id, data) => {
        try {
            const response = await client.request(updateItem('rqst_mstr', id, data));
            return response;
        } catch (error) {
            console.error("요청 수정 실패:", error);
            throw error;
        }
    }, []);

    // 답변 삭제
    const deleteAnswer = useCallback(async (id) => {
        try {
            await client.request(deleteItem('rqst_ans_dtl', id));
        } catch (error) {
            console.error("답변 삭제 실패:", error);
            throw error;
        }
    }, []);

    return {
        fetchRequests,
        fetchRequestDetail,
        createRequest,
        createAnswer,
        uploadRequestFiles,
        updateRequestStatus,
        updateRequest,
        deleteAnswer
    };
}
