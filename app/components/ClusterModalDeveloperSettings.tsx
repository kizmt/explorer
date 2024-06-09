import { localStorageIsAvailable } from '@utils/local-storage';
import { ChangeEvent } from 'react';

export default function ClusterModalDeveloperSettings() {
    const showDeveloperSettings = localStorageIsAvailable();
    const enableCustomUrl = showDeveloperSettings && localStorage.getItem('enableCustomUrl') !== null;
    const onToggleCustomUrlFeature = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            localStorage.setItem('enableCustomUrl', '');
        } else {
            localStorage.removeItem('enableCustomUrl');
        }
    };
    if (showDeveloperSettings !== true) {
        return null;
    }
    return (
        <>
        </>
    );
}
