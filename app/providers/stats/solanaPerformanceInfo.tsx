import { ClusterStatsStatus } from './solanaClusterStats';

export type PerformanceInfo = {
    status: ClusterStatsStatus;
    avgTps: number;
    historyMaxTps: number;
    perfHistory: {
        short: (number | null)[];
        medium: (number | null)[];
        long: (number | null)[];
    };
    transactionCount: bigint;
    trueTps: number;
};

export type PerformanceSample = {
    numTransactions: bigint;
    numSlots: bigint;
    samplePeriodSecs: number;
    numNonVoteTransactions: bigint;
};

export enum PerformanceInfoActionType {
    SetTransactionCount,
    SetPerfSamples,
    SetError,
    Reset,
}

export type PerformanceInfoActionSetTransactionCount = {
    type: PerformanceInfoActionType.SetTransactionCount;
    data: bigint;
};

export type PerformanceInfoActionSetPerfSamples = {
    type: PerformanceInfoActionType.SetPerfSamples;
    data: PerformanceSample[];
};

export type PerformanceInfoActionSetError = {
    type: PerformanceInfoActionType.SetError;
    data: string;
};

export type PerformanceInfoActionReset = {
    type: PerformanceInfoActionType.Reset;
    data: PerformanceInfo;
};

export type PerformanceInfoAction =
    | PerformanceInfoActionSetTransactionCount
    | PerformanceInfoActionSetPerfSamples
    | PerformanceInfoActionSetError
    | PerformanceInfoActionReset;

    export function performanceInfoReducer(state: PerformanceInfo, action: PerformanceInfoAction) {
        switch (action.type) {
            case PerformanceInfoActionType.SetPerfSamples: {
                if (action.data.length < 1) {
                    return state;
                }
    
                console.log("Received samples:", action.data);
    
                const short = action.data
                    .filter(sample => sample.numTransactions !== BigInt(0))
                    .map(sample => {
                        const avgTps = Number(sample.numTransactions) / sample.samplePeriodSecs;
                        const trueTps = Number(sample.numNonVoteTransactions) / sample.samplePeriodSecs;
    
                        console.log(`Sample: numTransactions=${sample.numTransactions}, numNonVoteTransactions=${sample.numNonVoteTransactions}, samplePeriodSecs=${sample.samplePeriodSecs}`);
                        console.log(`Calculated: avgTps=${avgTps}, trueTps=${trueTps}`);
    
                        return { avgTps, trueTps };
                    });
    
                const avgTps = short.length > 0 ? short.reduce((sum, s) => sum + s.avgTps, 0) / short.length : 0;
                const trueTps = short.length > 0 ? short.reduce((sum, s) => sum + s.trueTps, 0) / short.length : 0;
    
                console.log(`Final: avgTps=${avgTps}, trueTps=${trueTps}`);
    
                const medium = downsampleByFactor(short.map(s => s.avgTps), 4);
                const long = downsampleByFactor(medium, 3);
    
                const perfHistory = {
                    long: round(long.slice(0, 30)).reverse(),
                    medium: round(medium.slice(0, 30)).reverse(),
                    short: round(short.map(s => s.avgTps).slice(0, 30)).reverse(),
                };
    
                const historyMaxTps = Math.max(
                    Math.max(...perfHistory.short),
                    Math.max(...perfHistory.medium),
                    Math.max(...perfHistory.long)
                );
    
                const status = state.transactionCount !== BigInt(0) ? ClusterStatsStatus.Ready : ClusterStatsStatus.Loading;
    
                return {
                    ...state,
                    avgTps,
                    historyMaxTps,
                    perfHistory,
                    status,
                    trueTps,
                };
            }
    
            case PerformanceInfoActionType.SetTransactionCount: {
                const status = state.avgTps !== 0 ? ClusterStatsStatus.Ready : ClusterStatsStatus.Loading;
    
                return {
                    ...state,
                    status,
                    transactionCount: action.data,
                };
            }
    
            case PerformanceInfoActionType.SetError:
                return {
                    ...state,
                    status: ClusterStatsStatus.Error,
                };
    
            case PerformanceInfoActionType.Reset:
                return {
                    ...action.data,
                };
    
            default:
                return state;
        }
    }
    

function downsampleByFactor(series: number[], factor: number): number[] {
    return series.reduce((result: number[], num: number, i: number) => {
        const downsampledIndex = Math.floor(i / factor);
        if (result.length < downsampledIndex + 1) {
            result.push(0);
        }
        const mean = result[downsampledIndex];
        const differential = (num - mean) / ((i % factor) + 1);
        result[downsampledIndex] = mean + differential;
        return result;
    }, []);
}

function round(series: number[]): number[] {
    return series.map(n => Math.round(n));
}
