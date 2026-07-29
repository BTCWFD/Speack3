import { useCallback, useEffect, useState } from 'react';
import ApiService from '../services/ApiService';
import SocketService from '../services/SocketService';

// Avisos de la tienda (pedido nuevo para el vendedor, cambio de estado para el
// comprador).
//
// Se combinan dos fuentes a proposito: el socket trae los que llegan mientras
// la app esta abierta, y la consulta al API trae los que ocurrieron con la app
// cerrada. Con solo el socket se perderian justo los que mas importan.
export default function useNotifications({ autoLoad = true } = {}) {
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ApiService.getNotifications();
            setNotifications(data.notifications || []);
            setUnread(data.unread || 0);
        } catch (error) {
            // Un fallo al traer avisos no debe romper la pantalla que los usa.
            console.warn('No se pudieron cargar los avisos:', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (autoLoad) load();
    }, [autoLoad, load]);

    useEffect(() => {
        const unsubscribe = SocketService.onEvent('notification:new', (notification) => {
            setNotifications((prev) => {
                // El servidor puede reenviar el mismo aviso al reconectar.
                if (prev.some((n) => n._id === notification._id)) return prev;
                return [notification, ...prev];
            });
            setUnread((prev) => prev + 1);
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    const markRead = useCallback(async (id) => {
        // Optimista: la campana baja de inmediato y se corrige si el server falla.
        const target = notifications.find((n) => n._id === id);
        if (!target || target.read) return;

        setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
        setUnread((prev) => Math.max(0, prev - 1));

        try {
            await ApiService.markNotificationRead(id);
        } catch (error) {
            console.warn('No se pudo marcar el aviso como leido:', error.message);
            load();
        }
    }, [notifications, load]);

    const markAllRead = useCallback(async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnread(0);
        try {
            await ApiService.markAllNotificationsRead();
        } catch (error) {
            console.warn('No se pudieron marcar los avisos:', error.message);
            load();
        }
    }, [load]);

    return { notifications, unread, loading, reload: load, markRead, markAllRead };
}
