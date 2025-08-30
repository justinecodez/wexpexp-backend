import database from '../config/database';
import { Budget, Event } from '../entities';
import { Repository } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';

export interface BudgetCategory {
  name: string;
  plannedAmount: number;
  actualAmount: number;
  items: BudgetItem[];
}

export interface BudgetItem {
  id?: string;
  description: string;
  amount: number;
  status: 'PLANNED' | 'PAID' | 'CANCELLED';
  dueDate?: Date;
  paymentMethod?: string;
  attachments?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  categories: BudgetCategory[];
  upcomingPayments: BudgetItem[];
  recentTransactions: BudgetItem[];
}

export class BudgetService {
  private budgetRepository: Repository<Budget>;
  private eventRepository: Repository<Event>;

  constructor() {
    this.budgetRepository = database.getRepository(Budget) as Repository<Budget>;
    this.eventRepository = database.getRepository(Event) as Repository<Event>;
  }

  /**
   * Create or update event budget
   */
  async createOrUpdateBudget(
    userId: string,
    eventId: string,
    name: string,
    totalBudget: number,
    currency: string = 'TZS',
    categories: any = {}
  ): Promise<Budget> {
    // Verify event ownership
    const event = await this.eventRepository.findOne({
      where: { id: eventId, userId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    let budget = await this.budgetRepository.findOne({
      where: { eventId, userId },
    });

    if (budget) {
      budget.name = name;
      budget.totalBudget = totalBudget;
      budget.currency = currency;
      budget.categories = categories;
      budget.remainingBudget = totalBudget - budget.actualSpent;
    } else {
      budget = this.budgetRepository.create({
        userId,
        eventId,
        name,
        totalBudget,
        currency,
        categories,
        actualSpent: 0,
        remainingBudget: totalBudget,
        status: 'ACTIVE',
      });
    }

    const savedBudget = await this.budgetRepository.save(budget);
    logger.info(`Budget ${budget.id ? 'updated' : 'created'}: ${savedBudget.id} for event: ${eventId}`);

    return savedBudget;
  }

  /**
   * Add budget item to category
   */
  async addBudgetItem(
    userId: string,
    eventId: string,
    categoryName: string,
    item: {
      description: string;
      amount: number;
      status: 'PLANNED' | 'PAID' | 'CANCELLED';
      dueDate?: Date;
      paymentMethod?: string;
      attachments?: string[];
    }
  ): Promise<BudgetItem> {
    const budget = await this.validateEventAndBudget(userId, eventId);
    
    // Get current categories
    const categories = budget.categories || {};
    if (!categories[categoryName]) {
      categories[categoryName] = {
        plannedAmount: 0,
        actualAmount: 0,
        items: []
      };
    }

    // Create new budget item
    const budgetItem: BudgetItem = {
      id: Date.now().toString(), // Simple ID generation
      description: item.description,
      amount: item.amount,
      status: item.status,
      dueDate: item.dueDate,
      paymentMethod: item.paymentMethod,
      attachments: item.attachments || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add item to category
    categories[categoryName].items.push(budgetItem);
    
    // Update spent amount if paid
    if (item.status === 'PAID') {
      categories[categoryName].actualAmount += item.amount;
      budget.actualSpent += item.amount;
      budget.remainingBudget = budget.totalBudget - budget.actualSpent;
    }

    // Save updated budget
    budget.categories = categories;
    await this.budgetRepository.save(budget);

    logger.info(`Budget item added to category ${categoryName} for budget: ${budget.id}`);
    return budgetItem;
  }

  /**
   * Update budget item
   */
  async updateBudgetItem(
    userId: string,
    eventId: string,
    categoryName: string,
    itemId: string,
    updates: Partial<BudgetItem>
  ): Promise<BudgetItem> {
    const budget = await this.validateEventAndBudget(userId, eventId);
    const categories = budget.categories || {};
    
    if (!categories[categoryName]) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    const itemIndex = categories[categoryName].items.findIndex((item: any) => item.id === itemId);
    if (itemIndex === -1) {
      throw new AppError('Budget item not found', 404, 'BUDGET_ITEM_NOT_FOUND');
    }

    const item = categories[categoryName].items[itemIndex];
    const oldStatus = item.status;
    const oldAmount = item.amount;

    // Update item
    Object.assign(item, updates, { updatedAt: new Date() });

    // Update category and budget totals if status or amount changed
    if (oldStatus === 'PAID' && updates.status !== 'PAID') {
      // Item was paid, now it's not
      categories[categoryName].actualAmount -= oldAmount;
      budget.actualSpent -= oldAmount;
    } else if (oldStatus !== 'PAID' && updates.status === 'PAID') {
      // Item wasn't paid, now it is
      categories[categoryName].actualAmount += item.amount;
      budget.actualSpent += item.amount;
    } else if (oldStatus === 'PAID' && updates.status === 'PAID' && updates.amount && updates.amount !== oldAmount) {
      // Amount changed for paid item
      const amountDiff = item.amount - oldAmount;
      categories[categoryName].actualAmount += amountDiff;
      budget.actualSpent += amountDiff;
    }

    budget.remainingBudget = budget.totalBudget - budget.actualSpent;
    budget.categories = categories;
    await this.budgetRepository.save(budget);

    logger.info(`Budget item updated: ${itemId} in category ${categoryName}`);
    return item;
  }

  /**
   * Delete budget item
   */
  async deleteBudgetItem(userId: string, eventId: string, categoryName: string, itemId: string): Promise<void> {
    const budget = await this.validateEventAndBudget(userId, eventId);
    const categories = budget.categories || {};
    
    if (!categories[categoryName]) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    const itemIndex = categories[categoryName].items.findIndex((item: any) => item.id === itemId);
    if (itemIndex === -1) {
      throw new AppError('Budget item not found', 404, 'BUDGET_ITEM_NOT_FOUND');
    }

    const item = categories[categoryName].items[itemIndex];
    
    // Remove item from category
    categories[categoryName].items.splice(itemIndex, 1);

    // Update totals if item was paid
    if (item.status === 'PAID') {
      categories[categoryName].actualAmount -= item.amount;
      budget.actualSpent -= item.amount;
      budget.remainingBudget = budget.totalBudget - budget.actualSpent;
    }

    budget.categories = categories;
    await this.budgetRepository.save(budget);

    logger.info(`Budget item deleted: ${itemId} from category ${categoryName}`);
  }

  /**
   * Get budget summary
   */
  async getBudgetSummary(userId: string, eventId: string): Promise<BudgetSummary> {
    const budget = await this.validateEventAndBudget(userId, eventId);
    const categories = budget.categories || {};

    // Convert categories object to array
    const categoryArray: BudgetCategory[] = [];
    const upcomingPayments: BudgetItem[] = [];
    const recentTransactions: BudgetItem[] = [];

    Object.entries(categories).forEach(([categoryName, categoryData]: [string, any]) => {
      const items = categoryData.items || [];
      
      categoryArray.push({
        name: categoryName,
        plannedAmount: categoryData.plannedAmount || 0,
        actualAmount: categoryData.actualAmount || 0,
        items: items
      });

      // Collect upcoming payments and recent transactions
      items.forEach((item: BudgetItem) => {
        if (item.status === 'PLANNED' && item.dueDate) {
          upcomingPayments.push(item);
        }
        if (item.status === 'PAID') {
          recentTransactions.push(item);
        }
      });
    });

    // Sort upcoming payments by due date
    upcomingPayments.sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    // Sort recent transactions by update date and limit to 5
    recentTransactions.sort((a, b) => {
      if (!a.updatedAt || !b.updatedAt) return 0;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }).splice(5);

    return {
      totalBudget: budget.totalBudget,
      totalSpent: budget.actualSpent,
      remaining: budget.remainingBudget,
      categories: categoryArray,
      upcomingPayments: upcomingPayments,
      recentTransactions: recentTransactions,
    };
  }

  /**
   * Helper: Validate event ownership and get budget
   */
  private async validateEventAndBudget(userId: string, eventId: string): Promise<Budget> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId, userId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    const budget = await this.budgetRepository.findOne({
      where: { eventId },
    });

    if (!budget) {
      throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
    }

    return budget;
  }

  /**
   * Get budget by event ID
   */
  async getBudgetByEvent(userId: string, eventId: string): Promise<Budget | null> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId, userId },
    });

    if (!event) {
      throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    return this.budgetRepository.findOne({
      where: { eventId, userId },
    });
  }
}

export default new BudgetService();
