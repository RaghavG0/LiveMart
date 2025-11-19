-- Add trigger to automatically update stock when orders are placed or updated
CREATE TRIGGER trigger_update_stock_on_order
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_order();