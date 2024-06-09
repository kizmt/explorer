'use client'

import { Epoch } from '@components/common/Epoch';
import { Footer } from '@components/Footer';
import { SearchBar } from '@components/SearchBar';
import { StatsNotReady } from '@components/StatsNotReady';
import Logo from '@img/logos-solana/XRAY.svg';
import { useCluster } from '@providers/cluster';
import { StatsProvider } from '@providers/stats';
import {
    ClusterStatsStatus,
    useDashboardInfo,
    usePerformanceInfo,
    useStatsProvider,
} from '@providers/stats/solanaClusterStats';
import { SupplyProvider } from '@providers/supply';
import { slotsToHumanString } from '@utils/index';
import { percentage } from '@utils/math';
import Image from 'next/image';
import React from 'react';

export default function Page() {
    return (
        <StatsProvider>
            <SupplyProvider>
                <div className="container mt-4">
                    <StakingComponent />
                    <Image alt="XRAY" height={100} src={Logo} width={1100} className="container mt-5" />
                    <p className="text-center-bold">The simple Solana explorer</p>
                    <SearchBar />
                </div>
                <Footer />
            </SupplyProvider>
        </StatsProvider>
    );
}

function StakingComponent() {
    const dashboardInfo = useDashboardInfo();
    const performanceInfo = usePerformanceInfo();
    const { setActive } = useStatsProvider();
    const { cluster } = useCluster();

    React.useEffect(() => {
        setActive(true);
        return () => setActive(false);
    }, [setActive, cluster]);

    if (performanceInfo.status !== ClusterStatsStatus.Ready || dashboardInfo.status !== ClusterStatsStatus.Ready) {
        const error =
            performanceInfo.status === ClusterStatsStatus.Error || dashboardInfo.status === ClusterStatsStatus.Error;
        return <StatsNotReady error={error} />;
    }

    const { avgTps, trueTps } = performanceInfo;
    const averageTps = Math.round(avgTps).toLocaleString('en-US');
    const userTps = Math.round(trueTps).toLocaleString('en-US');
    const { avgSlotTime_1h, epochInfo } = dashboardInfo;
    const hourlySlotTime = Math.round(1000 * avgSlotTime_1h);
    const { slotIndex, slotsInEpoch } = epochInfo;
    const epochProgress = percentage(slotIndex, slotsInEpoch, 2).toFixed(1) + '%';
    const epochTimeRemaining = slotsToHumanString(Number(slotsInEpoch - slotIndex), hourlySlotTime);

    return (
        <div className="row staking-card">
            <div className="col-6 col-xl">
                <div className="card">
                    <div className="card-body">
                        <h4>Network Cycle</h4>
                        <h1>
                            <em>{epochProgress}</em> <small><Epoch epoch={epochInfo.epoch} link/></small>
                        </h1>
                        <h5>Time left: <em>{epochTimeRemaining}</em></h5>
                    </div>
                </div>
            </div>
            <div className="col-6 col-xl">
                <div className="card">
                    <div className="card-body">
                        <h4>User Transactions</h4>
                        <h1>
                            <em>{userTps}</em> <small>per second</small>
                        </h1>
                        <h5>
                            Total TPS: <em>{averageTps}</em>
                        </h5>
                    </div>
                </div>
            </div>
        </div>
    );
}



