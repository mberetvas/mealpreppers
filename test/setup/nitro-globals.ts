import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
  readMultipartFormData,
  sendStream,
  setHeader,
} from 'h3'

Object.assign(globalThis, {
  defineEventHandler,
  createError,
  getRouterParam,
  readBody,
  readMultipartFormData,
  sendStream,
  setHeader,
})
