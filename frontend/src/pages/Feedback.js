import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { feedbackAPI } from '../services/apiServices';
import { toast } from 'react-toastify';
import { FaStar, FaRegStar, FaPaperPlane, FaSignInAlt } from 'react-icons/fa';

const Feedback = () => {
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    ratings: {
      overallQuality: 0,
      digitalPresence: 0,
      facilities: 0
    },
    textFeedback: '',
    isAnonymous: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRatings, setHoveredRatings] = useState({
    overallQuality: 0,
    digitalPresence: 0,
    facilities: 0
  });

  const handleRatingClick = (category, rating) => {
    setFormData({
      ...formData,
      ratings: {
        ...formData.ratings,
        [category]: rating
      }
    });
  };

  const handleRatingHover = (category, rating) => {
    setHoveredRatings({
      ...hoveredRatings,
      [category]: rating
    });
  };

  const handleRatingLeave = (category) => {
    setHoveredRatings({
      ...hoveredRatings,
      [category]: 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate that at least one rating is provided
    const hasAtLeastOneRating = 
      formData.ratings.overallQuality > 0 || 
      formData.ratings.digitalPresence > 0 || 
      formData.ratings.facilities > 0;
    
    if (!hasAtLeastOneRating) {
      toast.warning('Please provide at least one rating');
      return;
    }

    setSubmitting(true);

    try {
      await feedbackAPI.submit(formData);
      toast.success('Thank you for your feedback!');
      
      // Reset form
      setFormData({
        ratings: {
          overallQuality: 0,
          digitalPresence: 0,
          facilities: 0
        },
        textFeedback: '',
        isAnonymous: false
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (category, currentRating) => {
    const displayRating = hoveredRatings[category] || currentRating;
    
    return (
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRatingClick(category, star)}
            onMouseEnter={() => handleRatingHover(category, star)}
            onMouseLeave={() => handleRatingLeave(category)}
            className="text-3xl transition transform hover:scale-110 focus:outline-none"
          >
            {star <= displayRating ? (
              <FaStar className="text-yellow-500" />
            ) : (
              <FaRegStar className="text-gray-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-lg font-semibold text-gray-700">
          {currentRating > 0 ? `${currentRating}/5` : 'Not rated'}
        </span>
      </div>
    );
  };

  const ratingCategories = [
    {
      key: 'overallQuality',
      label: 'Overall Quality',
      description: 'Rate the overall quality of the exhibition (Optional)',
      icon: '⭐'
    },
    {
      key: 'digitalPresence',
      label: 'Digital Presence',
      description: 'Rate the digital experience and online features (Optional)',
      icon: '💻'
    },
    {
      key: 'facilities',
      label: 'Facilities',
      description: 'Rate the facilities and amenities provided (Optional)',
      icon: '🏢'
    }
  ];

  return (
    <div className="fade-in max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Share Your Feedback</h1>
        <p className="text-gray-600">
          We value your opinion! Please provide at least one rating and share your thoughts with us.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
        {/* Rating Categories */}
        <div className="space-y-8 mb-8">
          {ratingCategories.map((category) => (
            <div key={category.key} className="border-b border-gray-200 pb-6 last:border-b-0">
              <div className="flex items-start mb-4">
                <span className="text-3xl mr-3">{category.icon}</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    {category.label}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {category.description}
                  </p>
                  {renderStars(category.key, formData.ratings[category.key])}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Text Feedback */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-gray-800 mb-2">
            Additional Comments (Optional)
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Share any additional thoughts, suggestions, or experiences
          </p>
          <textarea
            value={formData.textFeedback}
            onChange={(e) => setFormData({ ...formData, textFeedback: e.target.value })}
            placeholder="Your feedback helps us improve..."
            rows="5"
            maxLength="500"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
          <div className="text-right text-sm text-gray-500 mt-1">
            {formData.textFeedback.length}/500 characters
          </div>
        </div>

        {/* Anonymous Option */}
        <div className="mb-8">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isAnonymous}
              onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
              className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-700">
              Submit feedback anonymously
            </span>
          </label>
        </div>

        {/* Submit Button */}
        {isAuthenticated ? (
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center space-x-3 bg-primary-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="spinner w-6 h-6 border-2"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <FaPaperPlane />
                <span>Submit Feedback</span>
              </>
            )}
          </button>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-3">Please login to submit your feedback</p>
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              <FaSignInAlt />
              <span>Login to Submit</span>
            </Link>
          </div>
        )}
      </form>

      {/* Info Note */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> You can submit one feedback per day. Your feedback helps us improve the exhibition experience for everyone.
        </p>
      </div>
    </div>
  );
};

export default Feedback;
