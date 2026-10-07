// Registers the shared Threadline schemas (shared/models.js) on this service's mongoose instance.
import mongoose from 'mongoose'
import { defineModels, listedSourceProviders } from '../../../../shared/models.js'

export const { Seller, Customer, Admin, Product, Order, Reservation, RestockRequest, Verification, DeliveryPartner } = defineModels(mongoose)
export { listedSourceProviders }
