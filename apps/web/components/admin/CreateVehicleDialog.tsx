'use client';

import { useState, type FormEvent } from 'react';

import type { CreateVehicleInput } from './api-contracts';
import { ModalDialog } from './ModalDialog';

type CreateVehicleDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateVehicleInput) => Promise<void>;
};

export function CreateVehicleDialog({
  open,
  onClose,
  onCreate,
}: CreateVehicleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const driverName = String(data.get('driver_name') ?? '').trim();
    const input: CreateVehicleInput = {
      license_plate: String(data.get('license_plate') ?? '').trim().toUpperCase(),
      capacity_kg: Number(data.get('capacity_kg')),
      driver_name: driverName || null,
    };

    try {
      await onCreate(input);
      form.reset();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể thêm phương tiện.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      title="Thêm xe mới"
      description="Xe mới sẽ ở trạng thái sẵn sàng và có thể tham gia tối ưu tuyến."
      onClose={onClose}
    >
      <form className="management-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            <span>Biển số xe</span>
            <input
              name="license_plate"
              placeholder="51D-12345"
              minLength={2}
              maxLength={30}
              required
              autoFocus
            />
          </label>
          <label>
            <span>Tải trọng tối đa (kg)</span>
            <input
              name="capacity_kg"
              type="number"
              placeholder="750"
              min="0.1"
              step="0.1"
              required
            />
          </label>
          <label className="form-span-2">
            <span>Tên tài xế <small>(không bắt buộc)</small></span>
            <input
              name="driver_name"
              placeholder="Trần Minh Khoa"
              maxLength={150}
            />
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang thêm…' : 'Thêm phương tiện'}
          </button>
        </footer>
      </form>
    </ModalDialog>
  );
}
