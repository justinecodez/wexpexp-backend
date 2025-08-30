import { Request, Response } from 'express';
import { AccommodationService } from '../services/accommodationService';
import logger from '../config/logger';

export class AccommodationController {
  private accommodationService: AccommodationService;

  constructor() {
    this.accommodationService = new AccommodationService();
  }

  getPopularAccommodations = async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const location = req.query.location as string;

      const accommodations = await this.accommodationService.getPopularAccommodations(limit, location);

      res.json({
        success: true,
        data: accommodations,
        message: 'Popular accommodations retrieved successfully'
      });
    } catch (error) {
      logger.error('Error fetching popular accommodations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch popular accommodations'
      });
    }
  };

  searchAccommodations = async (req: Request, res: Response) => {
    try {
      const {
        location,
        checkIn,
        checkOut,
        guests,
        type,
        minPrice,
        maxPrice,
        amenities
      } = req.query;

      const searchParams = {
        location: location as string,
        checkIn: checkIn as string,
        checkOut: checkOut as string,
        guests: guests ? parseInt(guests as string) : undefined,
        type: type as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        amenities: amenities ? (amenities as string).split(',') : undefined
      };

      const results = await this.accommodationService.searchAccommodations(searchParams);

      res.json({
        success: true,
        data: results,
        message: 'Accommodations found'
      });
    } catch (error) {
      logger.error('Error searching accommodations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search accommodations'
      });
    }
  };

  getAvailableLocations = async (req: Request, res: Response) => {
    try {
      const locations = await this.accommodationService.getAvailableLocations();

      res.json({
        success: true,
        data: locations,
        message: 'Available locations retrieved successfully'
      });
    } catch (error) {
      logger.error('Error fetching locations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch locations'
      });
    }
  };

  getAccommodation = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const accommodation = await this.accommodationService.getAccommodationById(id);

      if (!accommodation) {
        return res.status(404).json({
          success: false,
          message: 'Accommodation not found'
        });
      }

      res.json({
        success: true,
        data: accommodation,
        message: 'Accommodation retrieved successfully'
      });
    } catch (error) {
      logger.error('Error fetching accommodation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch accommodation'
      });
    }
  };

  bookAccommodation = async (req: Request, res: Response) => {
    try {
      const bookingData = {
        ...req.body,
        userId: (req as any).user.id
      };

      const booking = await this.accommodationService.bookAccommodation(bookingData.userId, bookingData);

      res.status(201).json({
        success: true,
        data: booking,
        message: 'Accommodation booked successfully'
      });
    } catch (error: any) {
      logger.error('Error booking accommodation:', error);
      
      if (error.message.includes('not available')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to book accommodation'
      });
    }
  };

  getUserBookings = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;

      const pagination = {
        page,
        limit
      };

      const bookings = await this.accommodationService.getUserBookings(
        userId,
        pagination,
        status ? { status } : undefined
      );

      res.json({
        success: true,
        data: bookings,
        message: 'User bookings retrieved successfully'
      });
    } catch (error) {
      logger.error('Error fetching user bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings'
      });
    }
  };

  updateBooking = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const updateData = req.body;

      const booking = await this.accommodationService.updateBooking(id, userId, updateData);

      res.json({
        success: true,
        data: booking,
        message: 'Booking updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating booking:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update booking'
      });
    }
  };

  cancelBooking = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      await this.accommodationService.cancelBooking(id, userId);

      res.json({
        success: true,
        message: 'Booking cancelled successfully'
      });
    } catch (error: any) {
      logger.error('Error cancelling booking:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('cannot be cancelled')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to cancel booking'
      });
    }
  };

  createAccommodation = async (req: Request, res: Response) => {
    try {
      const accommodationData = {
        ...req.body,
        providerId: (req as any).user.id
      };

      const accommodation = await this.accommodationService.createAccommodation(accommodationData);

      res.status(201).json({
        success: true,
        data: accommodation,
        message: 'Accommodation created successfully'
      });
    } catch (error) {
      logger.error('Error creating accommodation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create accommodation'
      });
    }
  };

  updateAccommodation = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const updateData = req.body;

      const accommodation = await this.accommodationService.updateAccommodation(id, userId, updateData);

      res.json({
        success: true,
        data: accommodation,
        message: 'Accommodation updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating accommodation:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update accommodation'
      });
    }
  };

  deleteAccommodation = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      await this.accommodationService.deleteAccommodation(id, userId);

      res.json({
        success: true,
        message: 'Accommodation deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error deleting accommodation:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete accommodation'
      });
    }
  };

  updateAvailability = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const availabilityData = req.body;

      const availability = await this.accommodationService.updateAvailability(id, userId, availabilityData);

      res.json({
        success: true,
        data: availability,
        message: 'Availability updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating availability:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update availability'
      });
    }
  };
}
