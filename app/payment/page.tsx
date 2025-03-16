/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';

const PaymentPage = () => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistrationData = async () => {
      try {
        const response = await fetch('/registrations');
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

    const fetchPaymentData = async () => {
      try {
        const response = await fetch('/payments');
        const data = await response.json();
        if (response.ok) {
          setPayments(data.payments);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Failed to fetch payment data');
        console.error(err);
      }
    };

    fetchRegistrationData();
    fetchPaymentData();
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

      <h1>Payments</h1>
      {error && <p>{error}</p>}
      {payments.length > 0 ? (
        <ul>
          {payments.map((payment) => (
            <li key={payment.id}>
              {payment.from}: {payment.amountTotal} (Type: {payment.type}, Status: {payment.status})
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