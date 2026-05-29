
# 개요

프로젝트에 참여할 수 있는 멤버들

# 필드
id: 멤버의 고유 식별자(숫자) auto increment
username : 이름 (max length 20)
password: 비밀번호 (문자열 제약 없음)
grade : 멤버 등급 (SUPER, GENERAL)

# 화면에서 필요한 것들
## 가입화면 ("/signup)
- 단순 username, password 입력, 버튼 입력 폼
- 가입 시 username 중복 체크, password는 8자 이상 체크
- 가입 시 grade는 GENERAL로 고정
- 가입 성공 시 로그인 된 상태로 다시 Home으로 이동
- 자동로그인 체크박스. 자동로그인은 쿠키로 구현

## 로그인화면 ("/signin)
- 이름, 비밀번호 로그인
- 로그인 성공시 Home으로 이동

## 내정보 화면 "/me"
- 이름 나옴, 로그아웃 기능 추가

# 네비게이션
네비게이션 가장 우측 SignIn

# 기타
최초로 가입한 사람은 멤버등급을 SUPER 로 함.
