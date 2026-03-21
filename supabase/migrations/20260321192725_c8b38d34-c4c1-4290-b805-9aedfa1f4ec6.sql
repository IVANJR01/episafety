
-- Fix: Marcelo is linked to SUBESTAÇÃO BAHIA but should be SUBESTAÇÃO RN
UPDATE funcionarios 
SET contrato_id = 'ce83b53d-c193-4518-b9f2-c934f21b2e60'
WHERE id = '0c853013-aa3b-49bd-8481-d82cbe92c572';
