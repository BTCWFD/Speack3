import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { APP_VERSION_CODE } from '../config/version';

// Polls the server's /api/version once on mount and reports whether a newer
// build than the one currently running is available. Never throws: a failed
// or slow check (offline, cold-starting free-tier backend) just means no
// update is reported, it must never block or crash the app.
export const useUpdateCheck = () => {
    const [updateInfo, setUpdateInfo] = useState(null);

    useEffect(() => {
        let cancelled = false;

        axios
            .get(`${API_URL}/api/version`, { timeout: 8000 })
            .then(({ data }) => {
                if (!cancelled && data?.versionCode > APP_VERSION_CODE) {
                    setUpdateInfo(data);
                }
            })
            .catch(() => {
                // Offline or backend unreachable — silently skip, not an error
                // worth surfacing to the user.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return updateInfo;
};
