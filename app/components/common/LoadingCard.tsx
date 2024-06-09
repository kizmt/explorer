import React from 'react';

export function LoadingCard({ message }: { message?: string }) {
    return (
    <div className="d-flex justify-content-center mt-5">
        <div className="card" style={{ maxWidth: '600px', minWidth: '400px' }}>
            <div className="card-body text-center">
                <span className="align-text-top spinner-grow spinner-grow-sm me-2"></span>
                {message || 'Loading'}
            </div>
        </div>
    </div>
    );
}
