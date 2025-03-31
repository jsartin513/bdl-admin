'use client';
import { useEffect, useState } from 'react';

const Page = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/debug');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const json = await response.json();
                setData(json);
            } catch (err: unknown) {
                if (!(err instanceof Error)) return;

                setError(err.message);
            }
        };

        fetchData();
    }, []);

    return (
        <div>
            <h1>Backend Response</h1>
            {error ? (
                <p style={{ color: 'red' }}>Error: {error}</p>
            ) : data ? (
                <pre>{JSON.stringify(data, null, 2)}</pre>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default Page;
