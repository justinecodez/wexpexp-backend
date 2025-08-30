import { Request, Response, NextFunction } from 'express';
import budgetService from '../services/budgetService';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { catchAsync } from '../middleware/errorHandler';

export class BudgetController {
  /**
   * Create or update event budget
   */
  createOrUpdateBudget = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId } = req.params;
    const { name, totalBudget, currency, categories } = req.body;

    const budget = await budgetService.createOrUpdateBudget(
      req.user.userId,
      eventId,
      name || 'Event Budget',
      totalBudget || 0,
      currency || 'TZS',
      categories || {}
    );

    const response: ApiResponse = {
      success: true,
      message: 'Budget updated successfully',
      data: { budget },
    };

    res.status(200).json(response);
  });

  /**
   * Add budget item
   */
  addBudgetItem = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId } = req.params;
    const { categoryName, ...itemData } = req.body;
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
      });
    }

    const item = await budgetService.addBudgetItem(req.user.userId, eventId, categoryName, itemData);

    const response: ApiResponse = {
      success: true,
      message: 'Budget item added successfully',
      data: { item },
    };

    res.status(201).json(response);
  });

  /**
   * Update budget item
   */
  updateBudgetItem = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId, itemId } = req.params;
    const { categoryName, ...updates } = req.body;
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
      });
    }

    const item = await budgetService.updateBudgetItem(
      req.user.userId,
      eventId,
      categoryName,
      itemId,
      updates
    );

    const response: ApiResponse = {
      success: true,
      message: 'Budget item updated successfully',
      data: { item },
    };

    res.status(200).json(response);
  });

  /**
   * Delete budget item
   */
  deleteBudgetItem = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId, itemId } = req.params;
    const { categoryName } = req.body;
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required',
      });
    }

    await budgetService.deleteBudgetItem(req.user.userId, eventId, categoryName, itemId);

    const response: ApiResponse = {
      success: true,
      message: 'Budget item deleted successfully',
    };

    res.status(200).json(response);
  });

  /**
   * Get budget summary
   */
  getBudgetSummary = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { eventId } = req.params;
    const summary = await budgetService.getBudgetSummary(req.user.userId, eventId);

    const response: ApiResponse = {
      success: true,
      data: { summary },
    };

    res.status(200).json(response);
  });
}

export default new BudgetController();
