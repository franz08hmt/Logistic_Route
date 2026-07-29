UPDATE vehicles AS vehicle
SET status = 'IDLE'
WHERE vehicle.status = 'ON_ROUTE'
  AND NOT EXISTS (
    SELECT 1
    FROM orders AS delivery_order
    WHERE delivery_order.assigned_vehicle_id = vehicle.id
      AND delivery_order.status IN ('PENDING', 'ASSIGNED', 'DELIVERING')
  );
