'use client';

import { useCluster } from '@providers/cluster';
import { Cluster } from '@utils/cluster';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useId, useState } from 'react';
import { Search } from 'react-feather';
import { ActionMeta, InputActionMeta, ValueType } from 'react-select';
import AsyncSelect from 'react-select/async';

import { FetchedDomainInfo } from '../api/domain-info/[domain]/route';
import { LOADER_IDS, LoaderName, PROGRAM_INFO_BY_ID, SPECIAL_IDS, SYSVAR_IDS } from '../utils/programs';
import { searchTokens } from '../utils/token-search';

interface SearchOptions {
    label: string;
    options: {
        label: string;
        value: string[];
        pathname: string;
    }[];
}

const hasDomainSyntax = (value: string) => {
    return value.length > 4 && value.substring(value.length - 4) === '.sol';
};

export function SearchBar() {
    const [search, setSearch] = React.useState('');
    const selectRef = React.useRef<AsyncSelect<any> | null>(null);
    const router = useRouter();
    const { cluster, clusterInfo } = useCluster();
    const searchParams = useSearchParams();
    const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
    const [badgeOptions, setBadgeOptions] = useState<SearchOptions[]>([]);
    const [defaultOptions, setDefaultOptions] = useState<SearchOptions[]>([]);

    const onChange = ({ pathname }: ValueType<any, false>, meta: ActionMeta<any>) => {
        if (meta.action === 'select-option') {
            const nextQueryString = searchParams?.toString();
            router.push(`${pathname}${nextQueryString ? `?${nextQueryString}` : ''}`);
            setSearch('');
        }
    };

    const onInputChange = (value: string, { action }: InputActionMeta) => {
        if (action === 'input-change') {
            setSearch(value);
            setSelectedBadge(null);
        }
    };

    const loadOptions = useCallback(async (inputValue: string) => {
        if (selectedBadge) {
            switch (selectedBadge) {
                case 'Programs':
                    return [buildProgramOptions(inputValue, cluster)];
                case 'Program Loaders':
                    return [buildLoaderOptions(inputValue)];
                case 'Sysvars':
                    return [buildSysvarOptions(inputValue)];
                case 'Accounts':
                    return [buildSpecialOptions(inputValue)];
                case 'Tokens':
                    return [await buildTokenOptions(inputValue, cluster)];
                default:
                    return defaultOptions;
            }
        } else {
            return performSearch(inputValue);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBadge, cluster]);

    const handleBadgeClick = async (option: string) => {
        if (selectedBadge === option) {
            setSelectedBadge(null);
            setBadgeOptions(defaultOptions);
            setSearch('');
        } else {
            setSelectedBadge(option);
            setSearch('');
            let options = [];
            switch (option) {
                case 'Programs':
                    options = [buildProgramOptions('', cluster)];
                    break;
                case 'Program Loaders':
                    options = [buildLoaderOptions('')];
                    break;
                case 'Sysvars':
                    options = [buildSysvarOptions('')];
                    break;
                case 'Accounts':
                    options = [buildSpecialOptions('')];
                    break;
                case 'Tokens':
                    options = [await buildTokenOptions('', cluster)];
                    break;
                default:
                    options = defaultOptions;
            }
            setBadgeOptions(options.filter(Boolean) as SearchOptions[]);
        }
    };

    useEffect(() => {
        const fetchDefaultOptions = async () => {
            const options = [
                buildProgramOptions('', cluster),
                buildLoaderOptions(''),
                buildSysvarOptions(''),
                buildSpecialOptions(''),
                await buildTokenOptions('', cluster),
            ].filter(Boolean) as SearchOptions[];
            setDefaultOptions(options);
        };

        fetchDefaultOptions();
    }, [cluster]);

    useEffect(() => {
        if (selectedBadge) {
            loadOptions('');
        }
    }, [loadOptions, selectedBadge]);

    async function performSearch(search: string): Promise<SearchOptions[]> {
        const epoch = clusterInfo?.epochInfo?.epoch ? Number(clusterInfo.epochInfo.epoch) : undefined;
        const slotsInEpoch = clusterInfo?.epochInfo?.slotsInEpoch ? Number(clusterInfo.epochInfo.slotsInEpoch) : undefined;

        const localOptions = buildOptions(search, cluster, epoch, slotsInEpoch);
        let tokenOptions;
        try {
            tokenOptions = await buildTokenOptions(search, cluster);
        } catch (e) {
            console.error(`Failed to build token options for search: ${e instanceof Error ? e.message : e}`);
        }
        const tokenOptionsAppendable = tokenOptions ? [tokenOptions] : [];
        const domainOptions =
            hasDomainSyntax(search) && cluster === Cluster.MainnetBeta ? (await buildDomainOptions(search)) ?? [] : [];

        return [...localOptions, ...tokenOptionsAppendable, ...domainOptions];
    }

    const resetValue = '' as any;

    return (
        <div className="container my-5">
            <div className="row align-items-center justify-content-center mb-3">
                <div className="badge-container text-center mb-1">
                    {['Programs', 'Program Loaders', 'Sysvars', 'Accounts', 'Tokens'].map((badge, index) => (
                        <span
                            key={index}
                            className={`badge mx-1 rainbow-${(index % 5) + 1} ${selectedBadge === badge ? 'active' : ''}`}
                            onClick={() => handleBadgeClick(badge)}
                        >
                            {badge}
                        </span>
                    ))}
                </div>
            </div>
            <div className="row align-items-center justify-content-center">
                <div className="col-md-8 position-relative">
                    <AsyncSelect
                        cacheOptions
                        defaultOptions={badgeOptions.length ? badgeOptions : defaultOptions}
                        loadOptions={loadOptions}
                        autoFocus
                        inputId={useId()}
                        ref={ref => (selectRef.current = ref)}
                        noOptionsMessage={() => 'No Results'}
                        loadingMessage={() => 'loading...'}
                        placeholder="Search for tokens, programs, domains and transactions"
                        value={resetValue}
                        inputValue={search}
                        blurInputOnSelect
                        onMenuClose={() => selectRef.current?.blur()}
                        onChange={onChange}
                        styles={{
                            control: (provided) => ({
                                ...provided,
                                paddingLeft: '2rem',
                            }),
                            input: style => ({ ...style, width: '100%' }),
                            placeholder: style => ({ ...style, pointerEvents: 'none' }),
                        }}
                        onInputChange={onInputChange}
                        components={{ DropdownIndicator }}
                        classNamePrefix="search-bar"
                        onFocus={() => {
                            selectRef.current?.handleInputChange(search, { action: 'set-value' });
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function buildProgramOptions(search: string, cluster: Cluster): SearchOptions | undefined {
    const matchedPrograms = Object.entries(PROGRAM_INFO_BY_ID).filter(([address, { name, deployments }]) => {
        if (!deployments.includes(cluster)) return false;
        return name.toLowerCase().includes(search.toLowerCase()) || address.includes(search);
    });

    if (matchedPrograms.length > 0) {
        return {
            label: 'Programs',
            options: matchedPrograms.map(([address, { name }]) => ({
                label: name,
                pathname: '/address/' + address,
                value: [name, address],
            })),
        };
    }
}

const SEARCHABLE_LOADERS: LoaderName[] = ['BPF Loader', 'BPF Loader 2', 'BPF Upgradeable Loader'];

function buildLoaderOptions(search: string): SearchOptions | undefined {
    const matchedLoaders = Object.entries(LOADER_IDS).filter(([address, name]) => {
        return (
            SEARCHABLE_LOADERS.includes(name) &&
            (name.toLowerCase().includes(search.toLowerCase()) || address.includes(search))
        );
    });

    if (matchedLoaders.length > 0) {
        return {
            label: 'Program Loaders',
            options: matchedLoaders.map(([id, name]) => ({
                label: name,
                pathname: '/address/' + id,
                value: [name, id],
            })),
        };
    }
}

function buildSysvarOptions(search: string): SearchOptions | undefined {
    const matchedSysvars = Object.entries(SYSVAR_IDS).filter(([address, name]) => {
        return name.toLowerCase().includes(search.toLowerCase()) || address.includes(search);
    });

    if (matchedSysvars.length > 0) {
        return {
            label: 'Sysvars',
            options: matchedSysvars.map(([id, name]) => ({
                label: name,
                pathname: '/address/' + id,
                value: [name, id],
            })),
        };
    }
}

function buildSpecialOptions(search: string): SearchOptions | undefined {
    const matchedSpecialIds = Object.entries(SPECIAL_IDS).filter(([address, name]) => {
        return name.toLowerCase().includes(search.toLowerCase()) || address.includes(search);
    });

    if (matchedSpecialIds.length > 0) {
        return {
            label: 'Accounts',
            options: matchedSpecialIds.map(([id, name]) => ({
                label: name,
                pathname: '/address/' + id,
                value: [name, id],
            })),
        };
    }
}

async function buildTokenOptions(search: string, cluster: Cluster): Promise<SearchOptions | undefined> {
    const matchedTokens = await searchTokens(search, cluster);

    if (matchedTokens.length > 0) {
        return {
            label: 'Tokens',
            options: matchedTokens,
        };
    }
}

async function buildDomainOptions(search: string) {
    const domainInfoResponse = await fetch(`/api/domain-info/${search}`);
    const domainInfo = (await domainInfoResponse.json()) as FetchedDomainInfo;

    if (domainInfo && domainInfo.owner && domainInfo.address) {
        return [
            {
                label: 'Domain Owner',
                options: [
                    {
                        label: domainInfo.owner,
                        pathname: '/address/' + domainInfo.owner,
                        value: [search],
                    },
                ],
            },
            {
                label: 'Name Service Account',
                options: [
                    {
                        label: search,
                        pathname: '/address/' + domainInfo.address,
                        value: [search],
                    },
                ],
            },
        ];
    }
}


function buildOptions(
    search: string,
    cluster: Cluster,
    epoch?: number,
    slotsInEpoch?: number
): SearchOptions[] {
    const matchedPrograms = buildProgramOptions(search, cluster);
    const matchedLoaders = buildLoaderOptions(search);
    const matchedSysvars = buildSysvarOptions(search);
    const matchedSpecialIds = buildSpecialOptions(search);

    const epochOptions = epoch
        ? [
              {
                  label: 'Epoch',
                  options: [
                      {
                          label: `Epoch ${epoch}`,
                          pathname: '/epoch/' + epoch,
                          value: [`Epoch ${epoch}`],
                      },
                  ],
              },
          ]
        : [];

    const slotOptions = slotsInEpoch
        ? [
              {
                  label: 'Slot',
                  options: [
                      {
                          label: `Slot ${slotsInEpoch}`,
                          pathname: '/slot/' + slotsInEpoch,
                          value: [`Slot ${slotsInEpoch}`],
                      },
                  ],
              },
          ]
        : [];

    return [
        matchedPrograms,
        matchedLoaders,
        matchedSysvars,
        matchedSpecialIds,
        ...epochOptions,
        ...slotOptions,
    ].filter(Boolean) as SearchOptions[];
}

function DropdownIndicator() {
    return (
        <div className="search-indicator">
            <Search className="me-2" size={15} />
        </div>
    );
}
