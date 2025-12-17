// Entity classes for TypeORM
export { User } from './User';
export { Event } from './Event';
export { Invitation } from './Invitation';
export { ECard } from './ECard';
export { Tour } from './Tour';
export { Vehicle } from './Vehicle';
export { Accommodation } from './Accommodation';
export { Venue } from './Venue';
export { Decoration } from './Decoration';
export { Booking } from './Booking';
export { CarImportInquiry } from './CarImportInquiry';
export { InsurancePlan } from './InsurancePlan';
export { InsurancePolicy } from './InsurancePolicy';
export { Budget } from './Budget';
export { LandingPageContent } from './LandingPageContent';
export { Notification } from './Notification';
export { EventAnalytics } from './EventAnalytics';
export { Conversation } from './Conversation';
export { Message, MessageDirection, MessageStatus } from './Message';
export { MessageLog } from './MessageLog';
export { ECardTemplate } from './ECardTemplate';
export { Campaign } from './Campaign';
export { CampaignRecipient } from './CampaignRecipient';

// Export enums separately
export * from './enums';

// Entity classes array for TypeORM configuration
import { User } from './User';
import { Event } from './Event';
import { Invitation } from './Invitation';
import { ECard } from './ECard';
import { Tour } from './Tour';
import { Vehicle } from './Vehicle';
import { Accommodation } from './Accommodation';
import { Venue } from './Venue';
import { Decoration } from './Decoration';
import { Booking } from './Booking';
import { CarImportInquiry } from './CarImportInquiry';
import { InsurancePlan } from './InsurancePlan';
import { InsurancePolicy } from './InsurancePolicy';
import { Budget } from './Budget';
import { LandingPageContent } from './LandingPageContent';
import { Notification } from './Notification';
import { EventAnalytics } from './EventAnalytics';
import { ECardTemplate } from './ECardTemplate';
import { Conversation } from './Conversation';
import { Message } from './Message';
import { MessageLog } from './MessageLog';
import { Campaign } from './Campaign';
import { CampaignRecipient } from './CampaignRecipient';

export const entityClasses = [
  User,
  Event,
  Invitation,
  ECard,
  Tour,
  Vehicle,
  Accommodation,
  Venue,
  Decoration,
  Booking,
  CarImportInquiry,
  InsurancePlan,
  InsurancePolicy,
  Budget,
  LandingPageContent,
  Notification,
  EventAnalytics,
  ECardTemplate,
  Conversation,
  Message,
  MessageLog,
  Campaign,
  CampaignRecipient,
];
