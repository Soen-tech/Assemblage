sed -i 's/{order.item_name}/{order.product_name || order.item_name}/g' src/components/AdminSection.tsx
sed -i 's/{order.amount_gross}/{order.amount_gross || (order.quantity * order.unit_price)}/g' src/components/AdminSection.tsx
sed -i 's/order.status ===/order.fulfilment_status ===/g' src/components/AdminSection.tsx
sed -i 's/{order.status}/{order.fulfilment_status || order.status}/g' src/components/AdminSection.tsx
