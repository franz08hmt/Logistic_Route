'use client';

import { useState, type FormEvent } from 'react';

import type { CreateOrderInput } from './api-contracts';
import { ModalDialog } from './ModalDialog';

type CreateOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateOrderInput) => Promise<void>;
};

export function CreateOrderDialog({
  open,
  onClose,
  onCreate,
}: CreateOrderDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const input: CreateOrderInput = {
      order_code: String(data.get('order_code') ?? '').trim(),
      customer_name: String(data.get('customer_name') ?? '').trim(),
      address: String(data.get('address') ?? '').trim(),
      latitude: Number(data.get('latitude')),
      longitude: Number(data.get('longitude')),
      weight_kg: Number(data.get('weight_kg')),
    };

    try {
      await onCreate(input);
      form.reset();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể tạo đơn hàng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      title="Tạo đơn hàng mới"
      description="Nhập tọa độ chính xác để đơn hàng có thể tham gia tối ưu tuyến."
      onClose={onClose}
    >
      <form className="management-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            <span>Mã đơn</span>
            <input
              name="order_code"
              placeholder="LR-HCM-006"
              minLength={2}
              maxLength={50}
              required
              autoFocus
            />
          </label>
          <label>
            <span>Tên khách hàng</span>
            <input
              name="customer_name"
              placeholder="Nguyễn Văn A"
              maxLength={150}
              required
            />
          </label>
          <label className="form-span-2">
            <span>Địa chỉ giao hàng</span>
            <input
              name="address"
              placeholder="Phường Bến Nghé, Quận 1, TP.HCM"
              required
            />
          </label>
          <label>
            <span>Latitude</span>
            <input
              name="latitude"
              type="number"
              placeholder="10.7769"
              min={-90}
              max={90}
              step="any"
              required
            />
          </label>
          <label>
            <span>Longitude</span>
            <input
              name="longitude"
              type="number"
              placeholder="106.7009"
              min={-180}
              max={180}
              step="any"
              required
            />
          </label>
          <label className="form-span-2">
            <span>Khối lượng (kg)</span>
            <input
              name="weight_kg"
              type="number"
              placeholder="25"
              min="0.1"
              step="0.1"
              required
            />
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang tạo…' : 'Tạo đơn hàng'}
          </button>
        </footer>
      </form>
    </ModalDialog>
  );
}
