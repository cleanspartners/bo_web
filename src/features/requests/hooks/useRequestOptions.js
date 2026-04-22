import { useState, useEffect, useCallback } from 'react';
import client from '@/lib/directus';
import { readField } from '@directus/sdk';

export function useRequestOptions() {
    const [statuses, setStatuses] = useState([]);
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchOptions = useCallback(async () => {
        setLoading(true);
        try {
            const [statusField, typeField] = await Promise.all([
                client.request(readField('rqst_mstr', 'status')),
                client.request(readField('rqst_mstr', 'type'))
            ]);

            if (statusField?.meta?.options?.choices) {
                setStatuses(statusField.meta.options.choices);
            }
            
            if (typeField?.meta?.options?.choices) {
                setTypes(typeField.meta.options.choices);
            }
        } catch (error) {
            console.error("요청 옵션 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    return { statuses, types, loading };
}
