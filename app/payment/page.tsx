/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';

const PaymentPage = () => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistrationData = async () => {
      try {
        const response = await fetch('/sheets');
        const data = await response.json();
        if (response.ok) {
          setRegistrations(data.registrations);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Failed to fetch registration data');
        console.error(err);
      }
    };

    fetchRegistrationData();
  }, []);

  return (
    <div>
      <h1>Registered Users</h1>
      {error && <p>{error}</p>}
      {registrations.length > 0 ? (
        <ul>
          {registrations.map((registration) => (
            <li key={registration.email}>
              {registration.name} ({registration.email}) - {registration.registrationDate}
            </li>
          ))}
        </ul>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default PaymentPage;