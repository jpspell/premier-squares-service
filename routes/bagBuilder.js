const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const { 
  validate, 
  nameSchema
} = require('../middleware/validation');
const { 
  asyncErrorHandler, 
  handleFirebaseError
} = require('../utils/errorHandler');
const router = express.Router();

// Validation schema for the winner name
const winnerNameSchema = Joi.object({
  name: nameSchema
});

// Check if a winner already exists in the collection
const checkWinnerExists = async () => {
  try {
    const snapshot = await db.collection('bagBuilderWinners').limit(1).get();
    return {
      exists: !snapshot.empty,
      count: snapshot.size,
      winner: snapshot.empty ? null : snapshot.docs[0].data()
    };
  } catch (error) {
    throw error;
  }
};

// POST /bagbuilder/winner/:name - Set the bag builder winner
router.post('/winner/:name', asyncErrorHandler(async (req, res) => {
  const { name } = req.params;

  // Check if Firebase is available
  if (!db) {
    const error = new Error('Firebase service is not configured');
    error.name = 'ServiceUnavailableError';
    throw error;
  }

  try {
    // Validate the name parameter
    const { error: validationError } = winnerNameSchema.validate({ name });
    if (validationError) {
      const error = new Error('Invalid winner name');
      error.name = 'ValidationError';
      error.details = validationError.details;
      throw error;
    }

    // Check if a winner already exists
    const winnerCheck = await checkWinnerExists();
    
    if (winnerCheck.exists) {
      const error = new Error('A winner has already been set and cannot be changed');
      error.name = 'ValidationError';
      error.code = 'winner-already-exists';
      error.details = {
        existingWinner: winnerCheck.winner,
        message: 'Once a winner is set, it cannot be modified'
      };
      throw error;
    }

    // Create winner entry
    const winnerData = {
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add to Firebase collection
    const docRef = await db.collection('bagBuilderWinners').add(winnerData);

    res.status(201).json({
      success: true,
      message: 'Bag builder winner set successfully',
      data: {
        id: docRef.id,
        ...winnerData
      }
    });
  } catch (error) {
    // Handle Firebase-specific errors
    const { statusCode, response } = handleFirebaseError(error, req, 'set_bag_builder_winner');
    res.status(statusCode).json(response);
  }
}));

// GET /bagbuilder/winner - Get the current winner (if any)
router.get('/winner', asyncErrorHandler(async (req, res) => {
  if (!db) {
    const error = new Error('Firebase service is not configured');
    error.name = 'ServiceUnavailableError';
    throw error;
  }

  try {
    const winnerCheck = await checkWinnerExists();
    
    if (!winnerCheck.exists) {
      res.json({
        success: true,
        message: 'No winner yet',
        data: null
      });
      return;
    }

    res.json({
      success: true,
      message: 'Winner retrieved successfully',
      data: {
        id: winnerCheck.winner.id,
        ...winnerCheck.winner
      }
    });
  } catch (error) {
    // Handle Firebase-specific errors
    const { statusCode, response } = handleFirebaseError(error, req, 'get_bag_builder_winner');
    res.status(statusCode).json(response);
  }
}));

module.exports = router;
