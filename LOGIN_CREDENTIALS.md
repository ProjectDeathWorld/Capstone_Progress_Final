# Queue System Login Credentials

## Admin Account
- **Username:** admin
- **Password:** admin123
- **Role:** Admin

## Cashier Accounts (3 accounts)
- **Username:** cashier1
- **Password:** staff123
- **Full Name:** Cashier Staff 1

- **Username:** cashier2
- **Password:** staff123
- **Full Name:** Cashier Staff 2

- **Username:** cashier3
- **Password:** staff123
- **Full Name:** Cashier Staff 3

## Registrar Accounts (6 accounts)
- **Username:** registrar1
- **Password:** staff123
- **Full Name:** Registrar Staff 1

- **Username:** registrar2
- **Password:** staff123
- **Full Name:** Registrar Staff 2

- **Username:** registrar3
- **Password:** staff123
- **Full Name:** Registrar Staff 3

- **Username:** registrar4
- **Password:** staff123
- **Full Name:** Registrar Staff 4

- **Username:** registrar5
- **Password:** staff123
- **Full Name:** Registrar Staff 5

- **Username:** registrar6
- **Password:** staff123
- **Full Name:** Registrar Staff 6

## ITM Reliever Account
- **Username:** itm
- **Password:** itm123
- **Full Name:** ITM Staff 1
- **Role:** Staff / ITM
- **Default Coverage:** Cashier and Registrar

## Admission Staff Account
- **Username:** admission1
- **Password:** admission123
- **Full Name:** Admission Staff 1
- **Role:** Staff / Admission
- **Assigned Window:** Admission Window 1

## Security Accounts (for priority ticket authorization)
- **Username:** security1
- **Password:** security123
- **Security PIN:** 1234
- **Full Name:** Security Guard 1

- **Username:** security2
- **Password:** security123
- **Security PIN:** 5678
- **Full Name:** Security Guard 2

## Notes
- Passwords are stored using Laravel's configured secure password hashing
- Cashier accounts handle Cashier (CS) service queue
- Registrar accounts handle Registrar (RT) service queue with windows 1-6
- Security accounts authorize priority tickets at the kiosk
- Admin account has full system access
