import { localStorageIsAvailable } from '@utils/local-storage';

export default function ClusterModalDeveloperSettings() {
    const showDeveloperSettings = localStorageIsAvailable();
    if (showDeveloperSettings !== true) {
        return null;
    }
    return (
        <>
        </>
    );
}
