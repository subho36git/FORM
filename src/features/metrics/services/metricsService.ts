import { supabase } from '@/lib/supabase'
import type {
  BodyMeasurement,
  DbBodyMeasurement,
  AddMeasurementPayload,
  UpdateMeasurementPayload,
  ProgressPhoto,
  DbProgressPhoto,
  UploadPhotoPayload,
} from '../types'

const BUCKET_NAME = 'progress-photos'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function mapDbMeasurementToModel(row: DbBodyMeasurement): BodyMeasurement {
  return {
    id: row.id,
    userId: row.user_id,
    measuredDate: row.measured_date,
    waistCm: row.waist_cm !== null ? Number(row.waist_cm) : null,
    chestCm: row.chest_cm !== null ? Number(row.chest_cm) : null,
    shouldersCm: row.shoulders_cm !== null ? Number(row.shoulders_cm) : null,
    bicepLeftCm: row.bicep_left_cm !== null ? Number(row.bicep_left_cm) : null,
    bicepRightCm: row.bicep_right_cm !== null ? Number(row.bicep_right_cm) : null,
    forearmLeftCm: row.forearm_left_cm !== null ? Number(row.forearm_left_cm) : null,
    forearmRightCm: row.forearm_right_cm !== null ? Number(row.forearm_right_cm) : null,
    neckCm: row.neck_cm !== null ? Number(row.neck_cm) : null,
    hipsCm: row.hips_cm !== null ? Number(row.hips_cm) : null,
    thighLeftCm: row.thigh_left_cm !== null ? Number(row.thigh_left_cm) : null,
    thighRightCm: row.thigh_right_cm !== null ? Number(row.thigh_right_cm) : null,
    calfLeftCm: row.calf_left_cm !== null ? Number(row.calf_left_cm) : null,
    calfRightCm: row.calf_right_cm !== null ? Number(row.calf_right_cm) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDbPhotoToModel(row: DbProgressPhoto, signedUrl?: string | null): ProgressPhoto {
  return {
    id: row.id,
    userId: row.user_id,
    capturedDate: row.captured_date,
    pose: row.pose,
    storagePath: row.storage_path,
    signedUrl: signedUrl ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const metricsService = {
  /**
   * Fetches all body measurement records for the athlete in descending date order.
   */
  async getBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
    const { data, error } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      // Check if table does not exist yet (migration pending)
      if (error.code === '42P01') {
        console.warn('[MetricsService] body_measurements table not created yet. Please execute 008_body_metrics_and_photos.sql')
        return []
      }
      console.error('[MetricsService] Error fetching measurements:', error)
      throw new Error(`Failed to load body measurements: ${error.message}`)
    }

    if (!data) return []
    return (data as DbBodyMeasurement[]).map(mapDbMeasurementToModel)
  },

  /**
   * Inserts a new dated body measurement entry.
   */
  async addBodyMeasurement(userId: string, payload: AddMeasurementPayload): Promise<BodyMeasurement> {
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      measured_date: payload.measuredDate,
      waist_cm: payload.waistCm ?? null,
      chest_cm: payload.chestCm ?? null,
      shoulders_cm: payload.shouldersCm ?? null,
      bicep_left_cm: payload.bicepLeftCm ?? null,
      bicep_right_cm: payload.bicepRightCm ?? null,
      forearm_left_cm: payload.forearmLeftCm ?? null,
      forearm_right_cm: payload.forearmRightCm ?? null,
      neck_cm: payload.neckCm ?? null,
      hips_cm: payload.hipsCm ?? null,
      thigh_left_cm: payload.thighLeftCm ?? null,
      thigh_right_cm: payload.thighRightCm ?? null,
      calf_left_cm: payload.calfLeftCm ?? null,
      calf_right_cm: payload.calfRightCm ?? null,
      notes: payload.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('body_measurements')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) {
      console.error('[MetricsService] Error adding measurement:', error)
      throw new Error(`Failed to save body measurement: ${error.message}`)
    }

    return mapDbMeasurementToModel(data as DbBodyMeasurement)
  },

  /**
   * Updates an existing body measurement entry.
   */
  async updateBodyMeasurement(userId: string, payload: UpdateMeasurementPayload): Promise<BodyMeasurement> {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (payload.measuredDate !== undefined) updatePayload.measured_date = payload.measuredDate
    if (payload.waistCm !== undefined) updatePayload.waist_cm = payload.waistCm
    if (payload.chestCm !== undefined) updatePayload.chest_cm = payload.chestCm
    if (payload.shouldersCm !== undefined) updatePayload.shoulders_cm = payload.shouldersCm
    if (payload.bicepLeftCm !== undefined) updatePayload.bicep_left_cm = payload.bicepLeftCm
    if (payload.bicepRightCm !== undefined) updatePayload.bicep_right_cm = payload.bicepRightCm
    if (payload.forearmLeftCm !== undefined) updatePayload.forearm_left_cm = payload.forearmLeftCm
    if (payload.forearmRightCm !== undefined) updatePayload.forearm_right_cm = payload.forearmRightCm
    if (payload.neckCm !== undefined) updatePayload.neck_cm = payload.neckCm
    if (payload.hipsCm !== undefined) updatePayload.hips_cm = payload.hipsCm
    if (payload.thighLeftCm !== undefined) updatePayload.thigh_left_cm = payload.thighLeftCm
    if (payload.thighRightCm !== undefined) updatePayload.thigh_right_cm = payload.thighRightCm
    if (payload.calfLeftCm !== undefined) updatePayload.calf_left_cm = payload.calfLeftCm
    if (payload.calfRightCm !== undefined) updatePayload.calf_right_cm = payload.calfRightCm
    if (payload.notes !== undefined) updatePayload.notes = payload.notes?.trim() || null

    const { data, error } = await supabase
      .from('body_measurements')
      .update(updatePayload)
      .eq('id', payload.id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) {
      console.error('[MetricsService] Error updating measurement:', error)
      throw new Error(`Failed to update body measurement: ${error.message}`)
    }

    return mapDbMeasurementToModel(data as DbBodyMeasurement)
  },

  /**
   * Deletes a body measurement entry.
   */
  async deleteBodyMeasurement(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('body_measurements')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[MetricsService] Error deleting measurement:', error)
      throw new Error(`Failed to delete body measurement: ${error.message}`)
    }
  },

  /**
   * Fetches all progress photos for an athlete and resolves private signed URLs.
   */
  async getProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
    const { data, error } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', userId)
      .order('captured_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') {
        console.warn('[MetricsService] progress_photos table not created yet. Please execute 008_body_metrics_and_photos.sql')
        return []
      }
      console.error('[MetricsService] Error fetching photos:', error)
      throw new Error(`Failed to load progress photos: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    const photos = data as DbProgressPhoto[]

    // Batch resolve signed URLs for private objects (valid for 3600 seconds)
    const photosWithUrls = await Promise.all(
      photos.map(async (row) => {
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(row.storage_path, 3600)

          if (signedError || !signedData?.signedUrl) {
            console.warn(`[MetricsService] Could not generate signed URL for ${row.storage_path}:`, signedError)
            return mapDbPhotoToModel(row, null)
          }

          return mapDbPhotoToModel(row, signedData.signedUrl)
        } catch (err) {
          console.warn(`[MetricsService] Exception generating signed URL for ${row.storage_path}:`, err)
          return mapDbPhotoToModel(row, null)
        }
      })
    )

    return photosWithUrls
  },

  /**
   * Uploads an image to private Supabase Storage and records photo metadata in progress_photos.
   */
  async uploadProgressPhoto(userId: string, payload: UploadPhotoPayload): Promise<ProgressPhoto> {
    const file = payload.file

    // 1. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Image size exceeds 10MB limit. Please upload a smaller photo.')
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error('Unsupported image format. Allowed formats are JPEG, PNG, and WebP.')
    }

    // 3. Construct user-isolated storage path: {userId}/{date}_{pose}_{uuid}.{ext}
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12)
    const storagePath = `${userId}/${payload.capturedDate}_${payload.pose}_${uniqueId}.${cleanExt}`

    // 4. Upload to private Storage bucket
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[MetricsService] Storage upload failed:', uploadError)
      throw new Error(`Failed to upload photo to storage: ${uploadError.message}`)
    }

    // 5. Insert metadata into progress_photos
    const { data, error: insertError } = await supabase
      .from('progress_photos')
      .insert({
        user_id: userId,
        captured_date: payload.capturedDate,
        pose: payload.pose,
        storage_path: storagePath,
        notes: payload.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertError) {
      // Rollback uploaded file if DB insert fails
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]).catch(() => {})
      console.error('[MetricsService] DB photo insert failed:', insertError)
      throw new Error(`Failed to record photo metadata: ${insertError.message}`)
    }

    // 6. Generate signed URL for immediate display
    const { data: signedData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600)

    return mapDbPhotoToModel(data as DbProgressPhoto, signedData?.signedUrl)
  },

  /**
   * Deletes a progress photo record and removes the file from private storage.
   */
  async deleteProgressPhoto(userId: string, photoId: string, storagePath: string): Promise<void> {
    // 1. Delete DB record first
    const { error: dbError } = await supabase
      .from('progress_photos')
      .delete()
      .eq('id', photoId)
      .eq('user_id', userId)

    if (dbError) {
      console.error('[MetricsService] Error deleting photo record:', dbError)
      throw new Error(`Failed to delete progress photo: ${dbError.message}`)
    }

    // 2. Delete file from storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (storageError) {
      console.warn('[MetricsService] Could not remove storage file after deleting DB record:', storageError)
    }
  },
}

