'use client';

import React, { useState } from 'react';
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.COGNITO_EXTERNAL_USER_POOL_ID,
  ClientId: process.env.COGNITO_EXTERNAL_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

export default function AuthInterface({ api, params }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function signIn(e) {
    e.preventDefault();
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: async (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();

        await fetch('/api/auth/cognito-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, accessToken }),
        });

        location.replace('/');
      },
      onFailure: (err) => setError(err.message || JSON.stringify(err)),
    });
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Sign in</h2>
      <form onSubmit={signIn}>
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Sign in</button>
      </form>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}