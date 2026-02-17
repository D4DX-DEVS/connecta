import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/connecta-logo.svg';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Content */}
      <div className="text-center">
        <img src={logo} alt="Connecta" className="w-28 h-28 mx-auto drop-shadow-lg" />
        <h1 className="mt-6 text-4xl font-extrabold text-gray-800">Connecta</h1>
        <p className="mt-3 text-gray-600 text-lg">Welcome to the Exhibition Platform</p>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="mt-8 bg-primary-600 text-white px-10 py-3 rounded-2xl font-semibold hover:bg-primary-700 transition-morph shadow-lg"
        >
          Visit
        </button>
      </div>
      
      <div className="absolute bottom-8 text-center">
        <p className="text-gray-600 text-sm">
          Powered by <a href="https://d4dx.co" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-600 transition">d4dx.co</a>
        </p>
      </div>
    </div>
  );
};

export default Landing;
