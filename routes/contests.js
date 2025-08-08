const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const config = require('../config/config');
const logger = require('../utils/logger');
const { 
  validate, 
  validateContestId,
  eventIdSchema, 
  costPerSquareSchema, 
  namesArraySchema, 
  contestIdSchema 
} = require('../middleware/validation');
const { 
  createContestLimiter, 
  updateContestLimiter, 
  startContestLimiter 
} = require('../middleware/rateLimit');
const router = express.Router();

// Note: Validation is now handled by Joi schemas in middleware/validation.js

const validateContestExists = async (id) => {
  const doc = await db.collection('contests').doc(id).get();
  if (!doc.exists) {
    return { exists: false, error: 'Contest not found' };
  }
  return { exists: true, doc };
};

const validateContestStatus = (status, allowedStatus = 'new') => {
  if (status !== allowedStatus) {
    return { isValid: false, error: `Contest cannot be updated in '${status}' state. Only contests in '${allowedStatus}' state can be updated.` };
  }
  return { isValid: true };
};

const validateStartContest = (contestData) => {
  const validationErrors = [];
  
  // Check if contest status allows starting
  if (contestData.status !== 'new') {
    validationErrors.push(`Contest cannot be started in '${contestData.status}' state. Only contests in 'new' state can be started.`);
  }
  
  if (!contestData.eventId) {
    validationErrors.push('eventId is missing');
  }
  
  if (!contestData.costPerSquare || typeof contestData.costPerSquare !== 'number' || contestData.costPerSquare <= 0) {
    validationErrors.push('costPerSquare is missing or invalid');
  }
  
  if (!contestData.names || !Array.isArray(contestData.names)) {
    validationErrors.push('names array is missing');
  } else if (contestData.names.length !== 100) {
    validationErrors.push(`names array must have exactly 100 items (currently has ${contestData.names.length})`);
  } else {
    for (let i = 0; i < contestData.names.length; i++) {
      if (typeof contestData.names[i] !== 'string' || contestData.names[i].trim() === '') {
        validationErrors.push(`names[${i}] must be a non-empty string`);
        break;
      }
    }
  }
  
  return validationErrors;
};

// Create contest schema
const createContestSchema = Joi.object({
  eventId: eventIdSchema,
  costPerSquare: costPerSquareSchema
});

// POST /contests - Create a new contest entry
router.post('/', createContestLimiter, validate(createContestSchema), async (req, res) => {
  try {
    const { eventId, costPerSquare } = req.body;

    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase service is not configured'
      });
    }

    // Create contest entry
    const contestData = {
      eventId,
      costPerSquare,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'new'
    };

    // Add to Firebase collection
    const docRef = await db.collection('contests').add(contestData);

    res.status(201).json({
      success: true,
      message: 'Contest entry created successfully',
      documentId: docRef.id,
      data: {
        ...contestData,
        id: docRef.id
      }
    });

  } catch (error) {
    logger.error('Create contest error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create contest entry',
      details: config.isDevelopment ? error.message : undefined
    });
  }
});



// GET /contests/:id - Get a specific contest
router.get('/:id', validateContestId, async (req, res) => {
  try {
    const { id } = req.params;

    if (!db) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase service is not configured'
      });
    }

    const contestValidation = await validateContestExists(id);
    if (!contestValidation.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: contestValidation.error
      });
    }

    res.json({
      success: true,
      contest: {
        id: contestValidation.doc.id,
        ...contestValidation.doc.data()
      }
    });

  } catch (error) {
    logger.error('Fetch contest error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch contest',
      details: config.isDevelopment ? error.message : undefined
    });
  }
});

// Update contest schema
const updateContestSchema = Joi.object({
  names: namesArraySchema
});

// PUT /contests/:id - Update a contest
router.put('/:id', updateContestLimiter, validateContestId, validate(updateContestSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { names } = req.body;

    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase service is not configured'
      });
    }

    // Check if contest exists and validate status
    const contestValidation = await validateContestExists(id);
    if (!contestValidation.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: contestValidation.error
      });
    }

    const contestData = contestValidation.doc.data();
    const statusValidation = validateContestStatus(contestData.status);
    if (!statusValidation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: statusValidation.error,
        currentStatus: contestData.status
      });
    }

    // Update contest with names array
    const updateData = {
      names: names,
      updatedAt: new Date()
    };

    await db.collection('contests').doc(id).update(updateData);

    // Get updated document
    const updatedDoc = await db.collection('contests').doc(id).get();

    res.json({
      success: true,
      message: 'Contest updated successfully',
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    logger.error('Update contest error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update contest',
      details: config.isDevelopment ? error.message : undefined
    });
  }
});

// POST /contests/:id/start - Start a contest (validate all required fields)
router.post('/:id/start', startContestLimiter, validateContestId, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if Firebase is available
    if (!db) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase service is not configured'
      });
    }

    // Get the contest document
    const contestValidation = await validateContestExists(id);
    if (!contestValidation.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: contestValidation.error
      });
    }

    const contestData = contestValidation.doc.data();

    // Validate all required fields exist
    const validationErrors = validateStartContest(contestData);

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation Failed',
        message: 'Contest cannot start due to missing or invalid data',
        validationErrors,
        contestData: {
          id: contestValidation.doc.id,
          eventId: contestData.eventId,
          costPerSquare: contestData.costPerSquare,
          namesCount: contestData.names ? contestData.names.length : 0,
          status: contestData.status
        }
      });
    }

    // Shuffle the names array randomly
    const shuffledNames = [...contestData.names].sort(() => Math.random() - 0.5);

    // Update contest status to 'active' with shuffled names
    await db.collection('contests').doc(id).update({
      status: 'active',
      names: shuffledNames,
      updatedAt: new Date()
    });

    // Get updated document
    const updatedDoc = await db.collection('contests').doc(id).get();

    res.json({
      success: true,
      message: 'Contest has started successfully',
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    logger.error('Start contest error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start contest',
      details: config.isDevelopment ? error.message : undefined
    });
  }
});

module.exports = router;
