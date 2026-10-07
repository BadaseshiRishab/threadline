// Registers the shared Threadline schemas (shared/models.js) on this service's mongoose instance.
import mongoose from 'mongoose'
import { defineModels } from '../../../../shared/models.js'

export const { Seller, Customer, DeliveryPartner, Order, Product, Verification } = defineModels(mongoose)
