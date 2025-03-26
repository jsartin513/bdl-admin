/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';

const PAYMENT_AMOUNT = '$65.00';
const PAYMENT_TYPE = 'Payment';
const PAYMENT_TO = 'Boston Dodgeball League';

const PaymentPage = () => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistrationData = async () => {
      try {
        const response = await fetch('/api/registrations');
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
        const response = await fetch('/api/payments');
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

  const getPaymentDetails = (name: string) => {
    const payment = payments.find(payment => payment.from === name.trim() && payment.amountTotal === PAYMENT_AMOUNT && payment.to === PAYMENT_TO && payment.type === PAYMENT_TYPE);
    return payment ? { date: payment.date, transactionId: payment.id } : null;
  };

  const unmatchedPayments = payments.filter(payment => 
    payment.amountTotal === PAYMENT_AMOUNT && 
    payment.to === PAYMENT_TO && 
    payment.type === PAYMENT_TYPE &&
    !registrations.some(registration => registration.name.trim() === payment.from.trim())
  );

  const getTrimmedPaymentId = (paymentId: string) => {
    return paymentId.replace('payment-', '').replace('"', '').replace('"', '');
  };

  const sortedRegistrations = registrations.sort((a, b) => {
    const aPaid = getPaymentDetails(a.name) ? 1 : 0;
    const bPaid = getPaymentDetails(b.name) ? 1 : 0;
    return bPaid - aPaid;
  });

  const getPotentialMatches = (paymentFrom: string) => {
    const lastName = paymentFrom.split(' ').pop();
    return registrations.filter(registration => registration.name.includes(lastName));
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Payment Status', 'Payment Date', 'Transaction ID'];
    const rows = sortedRegistrations.map((registration) => {
      const paymentDetails = getPaymentDetails(registration.name);
      return [
        registration.name,
        registration.email,
        paymentDetails ? 'Paid' : 'No Payment Found',
        paymentDetails ? paymentDetails.date : '',
        paymentDetails ? getTrimmedPaymentId(paymentDetails.transactionId) : ''
      ];
    });

    const unmatchedHeaders = ['From', 'Amount', 'Type', 'Status'];
    const unmatchedRows = unmatchedPayments.map((payment) => [
      payment.from,
      payment.amountTotal,
      payment.type,
      payment.status
    ]);

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });

    csvContent += '\nUnmatched Payments\n';
    csvContent += unmatchedHeaders.join(',') + '\n';
    unmatchedRows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'registrations_and_unmatched_payments.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#fff', fontSize: '2em', borderBottom: '2px solid #333', paddingBottom: '10px' }}>Registered Players</h1>
      <button onClick={exportToCSV} style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>Export to CSV</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {registrations.length > 0 ? (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {sortedRegistrations.map((registration) => {
            const paymentDetails = getPaymentDetails(registration.name);
            return (
              <li key={registration.email} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
                <strong>{registration.name}</strong> ({registration.email}) - 
                {paymentDetails ? (
                  <span style={{ color: 'green' }}> Paid {paymentDetails.date} (Transaction ID: {getTrimmedPaymentId(paymentDetails.transactionId)})</span>
                ) : (
                  <span style={{ color: 'red' }}> No Payment Found</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Loading..</p>
      )}

      <h1 style={{ color: '#fff', fontSize: '2em', borderBottom: '2px solid #333', paddingBottom: '10px' }}>Unmatched Payments</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {unmatchedPayments.length > 0 ? (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {unmatchedPayments.map((payment) => (
            <li key={payment.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
              <strong>{payment.from}</strong>: {payment.amountTotal} (Type: {payment.type}, Status: {payment.status})
              <ul>
                {getPotentialMatches(payment.from).map((match) => (
                  <li key={match.email} style={{ marginTop: '5px', padding: '5px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    Potential Match: <strong>{match.name}</strong> ({match.email})
                  </li>
                ))}
              </ul>
            </li>
          ))} 
        </ul>
      ) : (
        <p>No unmatched payments found.</p>
      )}
    </div>
  );
};

export default PaymentPage;